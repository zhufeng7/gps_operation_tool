import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { tweets, username } = body;

    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tweets array is required' },
        { status: 400 }
      );
    }

    console.log(`[KeywordTrends] Analyzing trends for ${tweets.length} tweets from @${username}`);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI API key not configured' },
        { status: 500 }
      );
    }

    // 准备分析的推文数据，包含互动指标
    const tweetAnalysisData = tweets.map((tweet: any, index: number) => ({
      index: index + 1,
      text: tweet.text || '',
      likes: tweet.like_count || 0,
      retweets: tweet.retweet_count || 0,
      replies: tweet.reply_count || 0,
      engagement_score: (tweet.like_count || 0) + (tweet.retweet_count || 0) * 2 + (tweet.reply_count || 0) * 1.5,
      created_at: tweet.created_at
    }));

    // 按互动量排序，找出热门推文
    const sortedByEngagement = [...tweetAnalysisData].sort((a, b) => b.engagement_score - a.engagement_score);
    const topTweets = sortedByEngagement.slice(0, Math.min(10, tweets.length));

    const trendsPrompt = `
请分析以下推文数据，识别出引发高互动的关键词和话题趋势。

推文数据（按互动度排序）：
${topTweets.map(t => 
  `${t.index}. "${t.text}" 
   互动数据: 👍${t.likes} 🔄${t.retweets} 💬${t.replies} (总分:${t.engagement_score.toFixed(1)})`
).join('\n\n')}

总共分析 ${tweets.length} 条推文，以上显示互动度最高的 ${topTweets.length} 条。

请按以下JSON格式返回分析结果：
{
  "trending_keywords": [
    {
      "keyword": "AI",
      "frequency": 5,
      "avg_engagement": 45.2,
      "trend_direction": "上升",
      "impact_score": 0.85
    }
  ],
  "high_engagement_topics": [
    {
      "topic": "产品发布",
      "total_engagement": 156,
      "tweet_count": 3,
      "avg_engagement": 52.0,
      "keywords": ["新产品", "发布", "功能"]
    }
  ],
  "engagement_insights": [
    "包含'AI'关键词的推文互动率比平均水平高85%",
    "技术相关话题获得更多转发，平均转发率为15%"
  ],
  "trending_analysis": {
    "peak_engagement_period": "下午2-4点",
    "most_engaging_content_type": "技术分享",
    "audience_interest_trend": "对AI和技术内容兴趣持续上升"
  }
}

请重点分析：
1. 高互动推文中的关键词频率
2. 不同话题的平均互动水平
3. 引发关注的内容特征
4. 观众兴趣趋势变化
5. 最佳发布时间段分析

请确保返回有效的JSON格式。
`;

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的社交媒体数据分析师，擅长识别推文中的热门话题、关键词趋势和用户互动模式。请基于数据进行深入分析并提供可操作的洞察。'
            },
            {
              role: 'user',
              content: trendsPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[KeywordTrends] AI API error:', errorText);
        return NextResponse.json(
          { success: false, error: 'AI analysis failed' },
          { status: 500 }
        );
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content;

      if (!content) {
        return NextResponse.json(
          { success: false, error: 'No analysis result from AI' },
          { status: 500 }
        );
      }

      // 解析AI返回的JSON
      let trendsResult;
      try {
        // 提取JSON内容
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          trendsResult = JSON.parse(jsonMatch[0]);
        } else {
          trendsResult = JSON.parse(content);
        }
      } catch (parseError) {
        console.error('[KeywordTrends] Failed to parse AI response:', content);
        return NextResponse.json(
          { success: false, error: 'Failed to parse trends analysis result' },
          { status: 500 }
        );
      }

      // 计算基础统计信息
      const totalEngagement = tweetAnalysisData.reduce((sum, t) => sum + t.engagement_score, 0);
      const avgEngagement = totalEngagement / tweets.length;
      
      console.log(`[KeywordTrends] Successfully analyzed trends for @${username}`);
      
      return NextResponse.json({
        success: true,
        data: {
          username: username,
          analysis_period: {
            total_tweets: tweets.length,
            total_engagement: totalEngagement.toFixed(1),
            avg_engagement: avgEngagement.toFixed(1)
          },
          trending_keywords: trendsResult.trending_keywords || [],
          high_engagement_topics: trendsResult.high_engagement_topics || [],
          engagement_insights: trendsResult.engagement_insights || [],
          trending_analysis: trendsResult.trending_analysis || {}
        }
      });

    } catch (aiError: any) {
      console.error('[KeywordTrends] AI processing error:', aiError);
      return NextResponse.json(
        { success: false, error: 'Failed to process trends analysis' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[KeywordTrends] API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '关键词趋势分析失败',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}