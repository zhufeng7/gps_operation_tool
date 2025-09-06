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

    console.log(`[GetUserData] Fetching data for @${normalizedUsername}`);

    // 获取用户统计和推文数据
    const [userStats, allTweets, topTweets] = await Promise.all([
      dbService.getUserStats(normalizedUsername),
      dbService.getUserTweets(normalizedUsername),
      dbService.getTopTweets(normalizedUsername, 10)
    ]);

    if (!userStats) {
      return NextResponse.json(
        { success: false, error: '用户数据不存在，请先收集数据' },
        { status: 404 }
      );
    }

    // 记录搜索历史 - TEMPORARILY DISABLED when auth is disabled
    if (user) {
      await dbService.recordSearchHistory(
        user.id,
        normalizedUsername,
        'data_access',
        allTweets.length
      );
    }

    console.log(`[GetUserData] Retrieved ${allTweets.length} tweets for @${normalizedUsername}`);

    return NextResponse.json({
      success: true,
      data: {
        user: userStats,
        tweets: allTweets,
        topTweets: topTweets,
        stats: {
          totalTweets: allTweets.length,
          mediaTweets: allTweets.filter(t => t.has_media).length,
          avgEngagement: userStats.avg_engagement || 0,
          fromDatabase: true
        }
      }
    });

  } catch (error: any) {
    console.error('[GetUserData] API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '获取数据失败',
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