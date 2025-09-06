import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/services/database-service';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // TEMPORARILY DISABLED: Authentication check disabled for debugging login issues
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (authError || !user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '');
    const dbService = new DatabaseService(supabase);

    console.log(`[GetMediaTweets] Fetching media tweets for @${normalizedUsername}`);

    // 获取用户统计和媒体推文
    const [userStats, mediaTweets, allTweets] = await Promise.all([
      dbService.getUserStats(normalizedUsername),
      dbService.getMediaTweets(normalizedUsername),
      dbService.getUserTweets(normalizedUsername, 1) // 只取一条验证用户存在
    ]);

    if (!userStats || allTweets.length === 0) {
      return NextResponse.json(
        { success: false, error: '用户数据不存在，请先收集数据' },
        { status: 404 }
      );
    }

    // 格式化媒体推文数据
    const formattedTweets = mediaTweets.map(tweet => ({
      id: tweet.tweet_id,
      text: tweet.text,
      created_at: tweet.created_at,
      url: tweet.tweet_url || `https://twitter.com/${normalizedUsername}/status/${tweet.tweet_id}`,
      media: tweet.media_data || [],
      public_metrics: {
        like_count: tweet.like_count || 0,
        retweet_count: tweet.retweet_count || 0,
        reply_count: tweet.reply_count || 0,
        quote_count: tweet.quote_count || 0
      },
      engagement_score: tweet.engagement_score || 0
    }));

    // 记录搜索历史 - TEMPORARILY DISABLED when auth is disabled
    if (user) {
      await dbService.recordSearchHistory(
        user.id,
        normalizedUsername,
        'media_search',
        mediaTweets.length,
        { mediaOnly: true }
      );
    }

    console.log(`[GetMediaTweets] Retrieved ${mediaTweets.length} media tweets for @${normalizedUsername}`);

    return NextResponse.json({
      success: true,
      data: {
        username: normalizedUsername,
        user: userStats,
        totalTweets: userStats.collected_tweets_count || 0,
        mediaTweets: mediaTweets.length,
        searchTime: new Date().toLocaleString('zh-CN'),
        tweets: formattedTweets
      }
    });

  } catch (error: any) {
    console.error('[GetMediaTweets] API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '获取媒体推文失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}