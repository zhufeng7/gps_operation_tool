import { NextRequest, NextResponse } from 'next/server';
import { TwitterServiceV2 } from '@/lib/services/twitter-api-v2';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
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

    // Initialize new Twitter service
    const twitterService = new TwitterServiceV2();
    
    console.log(`[API] Starting maximum data collection for @${username}`);

    // Get comprehensive analysis with maximum data collection
    const analysisResult = await twitterService.getComprehensiveUserAnalysis(username);
    
    // 确保即使部分数据收集失败也能保存已获取的数据
    if (!analysisResult.tweets || analysisResult.tweets.length === 0) {
      console.warn(`[API] No tweets collected for @${username}, but continuing with user data`);
    } else {
      console.log(`[API] Successfully collected ${analysisResult.tweets.length} tweets for @${username}`);
    }
    
    // Format response for frontend
    const responseData = {
      user: {
        id: analysisResult.user.id,
        username: analysisResult.user.username,
        name: analysisResult.user.name,
        description: analysisResult.user.description,
        profile_image_url: analysisResult.user.profile_image_url,
        public_metrics: analysisResult.user.public_metrics,
        verified: analysisResult.user.verified,
        created_at: analysisResult.user.created_at,
        url: analysisResult.user.url,
        location: analysisResult.user.location
      },
      tweets: analysisResult.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author_id: tweet.author_id,
        public_metrics: tweet.public_metrics || {},
        lang: tweet.lang,
        has_media: tweet.has_media,
        media: tweet.media || [],
        tweet_url: tweet.tweet_url,
        referenced_tweets: tweet.referenced_tweets || [],
        entities: tweet.entities || {},
        context_annotations: tweet.context_annotations || [],
        conversation_id: tweet.conversation_id,
        in_reply_to_user_id: tweet.in_reply_to_user_id,
        possibly_sensitive: tweet.possibly_sensitive,
        source: tweet.source,
        collection_timestamp: tweet.collection_timestamp
      })),
      stats: analysisResult.stats,
      collection_metadata: {
        ...analysisResult.metadata,
        collection_time: new Date().toISOString(),
        api_version: 'v2_maximum_collection',
        data_quality: 'comprehensive'
      }
    };

    // Save collection metadata to search history
    const { error: historyError } = await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        search_type: 'maximum_tweet_collection',
        search_params: { 
          username,
          strategy: 'maximum_unlimited_historical',
          version: 'v2'
        },
        results_count: responseData.tweets.length,
        metadata: {
          time_span_days: responseData.stats.timeSpan.days,
          pages_processed: responseData.collection_metadata.pagesProcessed,
          rate_limit_hits: responseData.collection_metadata.rateLimitHits,
          has_more_data: responseData.collection_metadata.hasMoreData
        }
      });

    if (historyError) {
      console.warn('Failed to save search history:', historyError);
    }

    // Save account profile if doesn't exist
    const { data: existingAccount, error: selectError } = await supabase
      .from('account_profiles')
      .select('id')
      .eq('username', responseData.user.username)
      .single();

    const accountData = {
      username: responseData.user.username,
      twitter_link: `https://twitter.com/${responseData.user.username}`,
      website: responseData.user.url,
      followers_count: responseData.user.public_metrics?.followers_count || 0,
      following_count: responseData.user.public_metrics?.following_count || 0,
      tweet_count: responseData.user.public_metrics?.tweet_count || 0,
      account_created_at: responseData.user.created_at,
      profile_description: responseData.user.description,
      profile_image_url: responseData.user.profile_image_url,
      location: responseData.user.location,
      is_verified: responseData.user.verified || false,
      analysis_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Add collection stats
      last_collection_stats: {
        tweets_collected: responseData.tweets.length,
        time_span_days: responseData.stats.timeSpan.days,
        has_media_percent: responseData.stats.content.hasMediaPercent,
        avg_engagement: responseData.stats.engagement.avgLikes + responseData.stats.engagement.avgRetweets
      }
    };

    if (existingAccount) {
      await supabase
        .from('account_profiles')
        .update(accountData)
        .eq('id', existingAccount.id);
    } else {
      await supabase
        .from('account_profiles')
        .insert(accountData);
    }

    console.log(`[API] Maximum collection completed for @${username}:`);
    console.log(`  - ${responseData.tweets.length} tweets collected`);
    console.log(`  - ${responseData.collection_metadata.pagesProcessed} pages processed`);
    console.log(`  - ${responseData.stats.timeSpan.days} days time span`);

    return NextResponse.json({
      success: true,
      data: responseData,
      message: `Successfully collected ${responseData.tweets.length} tweets spanning ${responseData.stats.timeSpan.days} days`
    });

  } catch (error: any) {
    console.error('Maximum collection API error:', error);
    
    // 检查是否有部分数据可以保存
    let partialData = null;
    try {
      // 尝试获取用户基础信息
      const twitterService = new TwitterServiceV2();
      const user = await twitterService.getUserByUsername(username);
      if (user) {
        partialData = {
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            description: user.description,
            profile_image_url: user.profile_image_url,
            public_metrics: user.public_metrics,
            verified: user.verified,
            created_at: user.created_at,
            url: user.url,
            location: user.location
          },
          tweets: [], // 即使没有推文也返回空数组
          stats: {
            totalTweets: 0,
            mediaTweets: 0,
            timeSpan: { days: 0, months: 0, years: 0 },
            engagement: { avgLikes: 0, avgRetweets: 0, avgReplies: 0, totalEngagement: 0 },
            content: { hasMediaPercent: 0, avgLength: 0, languages: {} }
          },
          collection_metadata: {
            totalCollected: 0,
            pagesProcessed: 0,
            oldestTweetDate: null,
            newestTweetDate: null,
            timeSpanDays: 0,
            hasMoreData: false,
            collectionStrategy: 'maximum_unlimited_historical',
            rateLimitHits: 0,
            errors: [error.message],
            collectionTime: new Date().toISOString(),
            apiVersion: 'v2_maximum_collection'
          }
        };
      }
    } catch (userError) {
      console.error('Failed to get user info for partial data:', userError);
    }
    
    let errorMessage = 'Failed to collect tweets';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        errorMessage = 'Twitter API 速率限制，系统已尽可能收集数据。请稍后重试获取更多数据。';
        statusCode = 429;
      } else if (error.message.includes('not found') || error.message.includes('suspended')) {
        errorMessage = `用户 @${username || 'unknown'} 不存在或已被暂停`;
        statusCode = 404;
      } else if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        errorMessage = 'Twitter API 认证失败或访问被拒绝';
        statusCode = 401;
      } else {
        errorMessage = error.message;
      }
    }

    // 如果有部分数据且是速率限制错误，返回部分成功
    if (partialData && statusCode === 429) {
      return NextResponse.json({
        success: true,
        data: partialData,
        message: errorMessage,
        partial: true // 标记为部分数据
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        partialData,
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          stack: error?.stack,
          code: error?.code
        } : undefined
      },
      { status: statusCode }
    );
  }
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