import { NextRequest, NextResponse } from 'next/server';
import { TwitterServiceV2 } from '@/lib/services/twitter-api-v2';
import { DatabaseService } from '@/lib/services/database-service';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // 检查用户认证
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // 统一处理用户名（移除@，转小写）
    const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '');
    
    console.log(`[CollectTweets] Starting collection for @${normalizedUsername}`);

    // 初始化服务
    const twitterService = new TwitterServiceV2();
    const dbService = new DatabaseService(supabase);
    
    // 检查用户是否已存在以及最后收集时间
    const existingUser = await dbService.checkUserExists(normalizedUsername);
    const shouldRefresh = !existingUser || shouldRefreshData(existingUser);
    
    if (!shouldRefresh && existingUser) {
      // 返回已存在的数据
      const tweets = await dbService.getUserTweets(normalizedUsername);
      const userStats = await dbService.getUserStats(normalizedUsername);
      
      console.log(`[CollectTweets] Using existing data for @${normalizedUsername}: ${tweets.length} tweets`);
      
      return NextResponse.json({
        success: true,
        message: '使用已存储的数据',
        data: {
          user: userStats,
          tweets: tweets,
          stats: {
            totalTweets: tweets.length,
            fromCache: true
          }
        }
      });
    }

    // 开始新的收集会话
    let sessionId: string | null = null;
    let twitterUserId: string | null = null;

    try {
      console.log(`[CollectTweets] Fetching fresh data for @${normalizedUsername}`);
      
      // 获取用户信息和推文
      const result = await twitterService.getComprehensiveUserAnalysis(normalizedUsername);
      
      if (!result.user) {
        return NextResponse.json(
          { success: false, error: '用户不存在或已被暂停' },
          { status: 404 }
        );
      }

      // 保存/更新推特用户信息
      const twitterUser = await dbService.upsertTwitterUser({
        twitter_id: result.user.id,
        username: normalizedUsername,
        display_name: result.user.name,
        description: result.user.description,
        profile_image_url: result.user.profile_image_url,
        followers_count: result.user.public_metrics?.followers_count || 0,
        following_count: result.user.public_metrics?.following_count || 0,
        tweet_count: result.user.public_metrics?.tweet_count || 0,
        listed_count: result.user.public_metrics?.listed_count || 0,
        verified: result.user.verified || false,
        account_created_at: result.user.created_at,
        location: result.user.location,
        website_url: result.user.url
      });

      twitterUserId = twitterUser.id;

      // 创建收集会话记录
      const session = await dbService.createCollectionSession({
        user_id: user.id,
        twitter_user_id: twitterUserId,
        username: normalizedUsername,
        collection_status: 'in_progress',
        started_at: new Date().toISOString(),
        metadata: {
          api_version: 'v2',
          collection_strategy: 'comprehensive'
        }
      });

      sessionId = session.id;

      // 处理推文数据
      const tweets = result.tweets || [];
      const processedTweets = tweets.map(tweet => ({
        tweet_id: tweet.id,
        twitter_user_id: twitterUserId,
        text: tweet.text,
        created_at: tweet.created_at,
        like_count: tweet.public_metrics?.like_count || 0,
        retweet_count: tweet.public_metrics?.retweet_count || 0,
        reply_count: tweet.public_metrics?.reply_count || 0,
        quote_count: tweet.public_metrics?.quote_count || 0,
        has_media: Boolean(tweet.media && tweet.media.length > 0),
        media_data: tweet.media || null,
        entities: tweet.entities || null,
        context_annotations: tweet.context_annotations || null,
        conversation_id: tweet.conversation_id,
        in_reply_to_user_id: tweet.in_reply_to_user_id,
        possibly_sensitive: tweet.possibly_sensitive || false,
        source: tweet.source,
        lang: tweet.lang,
        referenced_tweets: tweet.referenced_tweets || null,
        tweet_url: `https://twitter.com/${normalizedUsername}/status/${tweet.id}`
      }));

      // 批量保存推文
      await dbService.insertTweets(processedTweets);

      // 计算时间跨度
      const dates = tweets.map(t => new Date(t.created_at).getTime());
      const oldestDate = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null;
      const newestDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;
      const timeSpanDays = dates.length > 0 ? Math.ceil((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)) : 0;

      // 更新收集会话为完成状态
      await dbService.updateCollectionSession(sessionId, {
        collection_status: 'completed',
        total_tweets_collected: tweets.length,
        pages_processed: result.metadata?.pagesProcessed || 0,
        api_calls_used: result.metadata?.rateLimitHits || 0,
        time_span_days: timeSpanDays,
        oldest_tweet_date: oldestDate,
        newest_tweet_date: newestDate,
        completed_at: new Date().toISOString()
      });

      // 记录搜索历史
      await dbService.recordSearchHistory(
        user.id,
        normalizedUsername,
        'tweet_collection',
        tweets.length,
        { comprehensive: true, time_span_days: timeSpanDays }
      );

      // 获取最新的用户统计
      const userStats = await dbService.getUserStats(normalizedUsername);
      const allTweets = await dbService.getUserTweets(normalizedUsername);

      console.log(`[CollectTweets] Successfully collected ${tweets.length} tweets for @${normalizedUsername}`);

      return NextResponse.json({
        success: true,
        message: `成功收集 ${tweets.length} 条推文`,
        data: {
          user: userStats,
          tweets: allTweets,
          stats: {
            totalTweets: allTweets.length,
            newTweets: tweets.length,
            timeSpanDays: timeSpanDays,
            fromCache: false
          },
          session: {
            id: sessionId,
            status: 'completed'
          }
        }
      });

    } catch (collectionError: any) {
      console.error('[CollectTweets] Collection error:', collectionError);

      // 如果有会话ID，更新为失败状态
      if (sessionId) {
        await dbService.updateCollectionSession(sessionId, {
          collection_status: 'failed',
          error_message: collectionError.message,
          completed_at: new Date().toISOString()
        });
      }

      // 尝试返回已存在的数据
      if (existingUser) {
        const tweets = await dbService.getUserTweets(normalizedUsername);
        const userStats = await dbService.getUserStats(normalizedUsername);
        
        return NextResponse.json({
          success: true,
          message: '新数据收集失败，返回已存储的数据',
          data: {
            user: userStats,
            tweets: tweets,
            stats: {
              totalTweets: tweets.length,
              fromCache: true
            }
          },
          warning: collectionError.message
        });
      }

      throw collectionError;
    }

  } catch (error: any) {
    console.error('[CollectTweets] API error:', error);
    
    let errorMessage = '数据收集失败';
    let statusCode = 500;

    if (error.message.includes('Rate limit')) {
      errorMessage = 'API 速率限制，请稍后重试';
      statusCode = 429;
    } else if (error.message.includes('not found') || error.message.includes('suspended')) {
      errorMessage = '用户不存在或已被暂停';
      statusCode = 404;
    } else if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      errorMessage = 'Twitter API 认证失败';
      statusCode = 401;
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: statusCode }
    );
  }
}

// 判断是否需要刷新数据（48小时策略）
function shouldRefreshData(existingUser: any): boolean {
  if (!existingUser || !existingUser.updated_at) return true;
  
  const lastUpdate = new Date(existingUser.updated_at);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  return hoursDiff >= 48; // 48小时后刷新
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}