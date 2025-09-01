import { NextRequest, NextResponse } from 'next/server';
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
    const { tweets, username } = body;

    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tweets array is required' },
        { status: 400 }
      );
    }

    console.log(`[ContentClassification] Analyzing ${tweets.length} tweets for @${username}`);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI API key not configured' },
        { status: 500 }
      );
    }

    // 准备分析的推文文本
    const tweetTexts = tweets.map((tweet: any, index: number) => ({
      index: index + 1,
      text: tweet.text || '',
      has_media: tweet.has_media || false,
      created_at: tweet.created_at
    }));

    const analysisPrompt = `
请分析以下推文内容，根据实际内容特征自行创建最合适的分类类别，无需拘泥于预设类别。

推文内容：
${tweetTexts.map(t => `${t.index}. ${t.text} ${t.has_media ? '(含媒体)' : ''}`).join('\n')}

请按以下格式返回JSON结果：
{
  "summary": {
    "AI技术讨论": 5,
    "产品更新": 3,
    "行业观点": 2,
    "用户互动": 1
  },
  "insights": [
    "该账号主要专注于AI技术相关内容",
    "产品更新类推文获得较高互动"
  ],
  "trending_keywords": [
    {"keyword": "AI", "frequency": 8, "avg_engagement": 45},
    {"keyword": "技术", "frequency": 5, "avg_engagement": 32}
  ]
}

要求：
1. 根据推文内容自动创建最贴切的分类类别名称
2. 提供内容分布统计
3. 识别高频关键词及其平均互动表现
4. 给出基于数据的洞察建议
5. 确保返回有效的JSON格式

请基于实际内容创建分类，不要使用通用类别。
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
              content: '你是一个专业的社交媒体内容分析师。请根据推文实际内容特征自行创建最合适的分类类别，并提供深度分析。重点关注内容主题、关键词趋势和互动模式。'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ContentClassification] AI API error:', errorText);
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
      let analysisResult;
      try {
        // 提取JSON内容（可能包含在代码块中）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          analysisResult = JSON.parse(content);
        }
      } catch (parseError) {
        console.error('[ContentClassification] Failed to parse AI response:', content);
        return NextResponse.json(
          { success: false, error: 'Failed to parse analysis result' },
          { status: 500 }
        );
      }

      // 确保结果包含必要字段
      if (!analysisResult.summary) {
        return NextResponse.json(
          { success: false, error: 'Invalid analysis result format' },
          { status: 500 }
        );
      }

      console.log(`[ContentClassification] Successfully analyzed tweets for @${username}`);
      
      return NextResponse.json({
        success: true,
        data: {
          username: username,
          total_tweets: tweets.length,
          summary: analysisResult.summary,
          insights: analysisResult.insights || [],
          trending_keywords: analysisResult.trending_keywords || []
        }
      });

    } catch (aiError: any) {
      console.error('[ContentClassification] AI processing error:', aiError);
      return NextResponse.json(
        { success: false, error: 'Failed to process AI analysis' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[ContentClassification] API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '内容分类失败',
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