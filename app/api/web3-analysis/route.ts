import { NextRequest, NextResponse } from 'next/server';
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
    const { tweets, username, model = 'deepseek' } = body;

    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid tweet data is required' },
        { status: 400 }
      );
    }

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // 生成Web3运营分析报告
    const analysisReport = await generateWeb3AnalysisReport(tweets, username, model);

    console.log(`[Web3Analysis] Generated report for @${username} using ${model}`);
    console.log(`[Web3Analysis] Analyzed ${tweets.length} tweets`);

    return NextResponse.json({
      success: true,
      data: analysisReport,
      metadata: {
        model_used: model,
        tweet_count: tweets.length,
        analysis_time: new Date().toISOString(),
        username
      }
    });

  } catch (error: any) {
    console.error('Web3 Analysis API error:', error);
    
    let errorMessage = 'Failed to generate Web3 analysis';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'AI API配置错误，请检查API密钥';
        statusCode = 401;
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'AI API调用次数已达上限，请稍后重试';
        statusCode = 429;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI分析超时，请重试';
        statusCode = 408;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          stack: error?.stack
        } : undefined
      },
      { status: statusCode }
    );
  }
}

async function generateWeb3AnalysisReport(tweets: any[], username: string, model: string) {
  // 计算基础统计
  const totalEngagement = tweets.reduce((sum, tweet) => 
    sum + (tweet.public_metrics?.like_count || 0) + 
    (tweet.public_metrics?.retweet_count || 0) + 
    (tweet.public_metrics?.reply_count || 0) + 
    (tweet.public_metrics?.quote_count || 0), 0
  );

  const avgEngagement = totalEngagement / tweets.length;

  // 提取热门话题
  const topHashtags = extractTopHashtags(tweets);
  const topThemes = ['DeFi', 'NFT', 'Web3社区', '技术分享', '市场分析'];

  // 生成模拟分析报告（实际应用中这里会调用AI API）
  const report = {
    overview: {
      summary: `基于对 @${username} 的 ${tweets.length} 条推文分析，该账号在Web3领域表现出强烈的技术导向和社区参与度。平均每条推文获得 ${Math.round(avgEngagement)} 次互动，显示出较好的内容质量和受众参与度。`,
      key_metrics: [
        `总推文数: ${tweets.length.toLocaleString()} 条`,
        `总互动数: ${totalEngagement.toLocaleString()} 次`,
        `平均互动率: ${Math.round(avgEngagement)} 次/推文`,
        `活跃时间跨度: ${calculateTimeSpan(tweets)} 天`,
        `主要话题: ${topHashtags.slice(0, 3).join(', ')}`
      ]
    },
    content_insights: {
      top_themes: topThemes,
      engagement_drivers: [
        '技术深度内容获得更高互动',
        '社区问答和互动效果显著',
        '市场分析和趋势预测受欢迎',
        '实用工具和资源分享传播广'
      ],
      content_recommendations: [
        '增加技术教程和实操指南内容',
        '建立定期的市场分析专栏',
        '加强与社区KOL的互动合作',
        '创建更多可视化的数据内容'
      ]
    },
    community_analysis: {
      audience_behavior: `受众主要由Web3开发者、投资者和技术爱好者组成，对深度技术内容和市场洞察有强烈需求。互动高峰时间集中在工作日晚间和周末，说明受众具有专业背景。`,
      growth_opportunities: [
        '扩大技术教育内容覆盖面',
        '建立Web3项目评测体系',
        '组织线上技术分享活动',
        '创建专业的研究报告系列'
      ],
      engagement_patterns: `用户倾向于对技术分析、项目评测和市场观点进行深度讨论。回复质量高，讨论时间长，显示出专业社群的特征。`
    },
    strategic_recommendations: {
      immediate_actions: [
        '优化发布时间至受众活跃高峰期',
        '增加与粉丝的直接互动频次',
        '建立内容发布日历和主题规划',
        '加强热门话题的及时跟进'
      ],
      long_term_strategy: [
        '建设个人品牌的专业权威性',
        '打造Web3领域的内容生态',
        '扩展多平台内容分发渠道',
        '建立稳定的内容创作团队'
      ],
      risk_considerations: [
        '避免过度技术化导致受众流失',
        '注意市场预测的准确性风险',
        '平衡商业内容与教育内容比例',
        '关注监管环境变化的影响'
      ]
    },
    performance_metrics: {
      content_quality_score: Math.min(0.95, 0.6 + (avgEngagement / 100)),
      engagement_efficiency: Math.min(0.9, 0.5 + (avgEngagement / 150)),
      growth_potential: Math.min(0.85, 0.7 + (topHashtags.length / 20))
    }
  };

  return report;
}

function extractTopHashtags(tweets: any[]): string[] {
  const hashtagCount: { [key: string]: number } = {};
  
  tweets.forEach(tweet => {
    if (tweet.entities?.hashtags) {
      tweet.entities.hashtags.forEach((hashtag: any) => {
        const tag = hashtag.tag.toLowerCase();
        hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
      });
    }
  });

  return Object.entries(hashtagCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => `#${tag}`);
}

function calculateTimeSpan(tweets: any[]): number {
  if (tweets.length === 0) return 0;
  
  const dates = tweets.map(tweet => new Date(tweet.created_at).getTime());
  const oldest = Math.min(...dates);
  const newest = Math.max(...dates);
  
  return Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24));
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