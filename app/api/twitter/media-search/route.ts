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
    const { 
      username, 
      maxResults = 100, 
      maxPages = 20, 
      months = 6,
      includeReplies = false 
    } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log(`[API] 开始搜索 ${username} 的媒体推文，参数:`, {
      maxResults,
      maxPages,
      months,
      includeReplies
    });

    // Initialize Twitter service
    const twitterService = new TwitterServiceV2();
    
    // Search for media tweets with enhanced parameters
    const searchResults = await twitterService.searchUserMediaTweets(
      username.replace('@', ''),
      { 
        maxResults, 
        maxPages, 
        months,
        includeReplies 
      }
    );

    // Log search history
    const { error: historyError } = await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        search_type: 'media_search',
        search_params: { username },
        results_count: searchResults.stats.mediaTweets
      });

    if (historyError) {
      console.warn('Failed to log search history:', historyError);
    }

    // Format response for frontend
    const result = {
      username: searchResults.user.username,
      totalTweets: searchResults.stats.totalTweets,
      mediaTweets: searchResults.stats.mediaTweets,
      searchTime: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      tweets: searchResults.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        url: tweet.url,
        media: tweet.media,
        public_metrics: tweet.public_metrics
      }))
    };

    return NextResponse.json({
      success: true,
      result,
      meta: {
        user: {
          id: searchResults.user.id,
          username: searchResults.user.username,
          name: searchResults.user.name,
          verified: searchResults.user.verified,
          profile_image_url: searchResults.user.profile_image_url
        }
      }
    });

  } catch (error) {
    console.error('Media search API error:', error);
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('User not found')) {
        errorMessage = '用户不存在，请检查用户名是否正确';
        statusCode = 404;
      } else if (error.message.includes('Rate limit')) {
        errorMessage = 'API 调用频率限制，请稍后重试';
        statusCode = 429;
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'Twitter API 认证失败';
        statusCode = 401;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: statusCode }
    );
  }
}

// Handle OPTIONS request for CORS
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