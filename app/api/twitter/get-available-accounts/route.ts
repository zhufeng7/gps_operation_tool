import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // TEMPORARILY DISABLED: Authentication check disabled for debugging login issues
    // const { data: { user }, error: authError } = await supabase.auth.getUser();
    // if (authError || !user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Authentication required' },
    //     { status: 401 }
    //   );
    // }

    console.log(`[GetAvailableAccounts] Fetching available accounts`);

    // 获取所有有推文数据的推特账号
    const { data: accounts, error } = await supabase
      .from('user_stats')
      .select(`
        id,
        username,
        display_name,
        profile_image_url,
        followers_count,
        tweet_count,
        collected_tweets_count,
        latest_tweet_date,
        earliest_tweet_date,
        avg_engagement,
        media_tweets_count,
        updated_at
      `)
      .gt('collected_tweets_count', 0)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }

    // 计算每个账号的数据统计
    const processedAccounts = (accounts || []).map(account => ({
      id: account.id,
      username: account.username,
      displayName: account.display_name || account.username,
      profileImage: account.profile_image_url,
      stats: {
        followers: account.followers_count || 0,
        totalTweets: account.tweet_count || 0,
        collectedTweets: account.collected_tweets_count || 0,
        mediaTweets: account.media_tweets_count || 0,
        avgEngagement: Math.round(account.avg_engagement || 0)
      },
      dataInfo: {
        latestTweetDate: account.latest_tweet_date,
        earliestTweetDate: account.earliest_tweet_date,
        lastUpdated: account.updated_at,
        timeSpanDays: account.latest_tweet_date && account.earliest_tweet_date ? 
          Math.ceil((new Date(account.latest_tweet_date).getTime() - new Date(account.earliest_tweet_date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        dataFreshness: getDataFreshness(account.updated_at)
      }
    }));

    console.log(`[GetAvailableAccounts] Retrieved ${processedAccounts.length} accounts`);

    return NextResponse.json({
      success: true,
      data: {
        accounts: processedAccounts,
        totalAccounts: processedAccounts.length
      }
    });

  } catch (error: any) {
    console.error('[GetAvailableAccounts] API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '获取账号列表失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// 计算数据新鲜度
function getDataFreshness(lastUpdated: string): string {
  const now = new Date();
  const updated = new Date(lastUpdated);
  const hoursDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff < 1) return 'fresh'; // 1小时内
  if (hoursDiff < 24) return 'recent'; // 24小时内
  if (hoursDiff < 48) return 'valid'; // 48小时内
  return 'stale'; // 超过48小时
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