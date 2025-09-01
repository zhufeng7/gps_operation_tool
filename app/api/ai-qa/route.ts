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
    const { question, tweets, username, model = 'deepseek' } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { success: false, error: 'Question is required' },
        { status: 400 }
      );
    }

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

    // 生成AI问答响应
    const qaResponse = await generateAIResponse(question.trim(), tweets, username, model);

    console.log(`[AI-QA] Answered question for @${username} using ${model}`);
    console.log(`[AI-QA] Question: ${question.substring(0, 100)}${question.length > 100 ? '...' : ''}`);

    return NextResponse.json({
      success: true,
      data: qaResponse,
      metadata: {
        model_used: model,
        tweet_count: tweets.length,
        question_length: question.length,
        response_time: new Date().toISOString(),
        username
      }
    });

  } catch (error: any) {
    console.error('AI QA API error:', error);
    
    let errorMessage = 'Failed to generate AI response';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'AI API配置错误，请检查API密钥';
        statusCode = 401;
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'AI API调用次数已达上限，请稍后重试';
        statusCode = 429;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI问答超时，请重试';
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

async function generateAIResponse(question: string, tweets: any[], username: string, model: string) {
  // 分析问题类型和关键词
  const questionLower = question.toLowerCase();
  
  // 计算基础统计
  const totalEngagement = tweets.reduce((sum, tweet) => 
    sum + (tweet.public_metrics?.like_count || 0) + 
    (tweet.public_metrics?.retweet_count || 0) + 
    (tweet.public_metrics?.reply_count || 0) + 
    (tweet.public_metrics?.quote_count || 0), 0
  );

  const avgEngagement = totalEngagement / tweets.length;

  // 找出最相关的推文
  const relevantTweets = findRelevantTweets(question, tweets);

  // 生成回答（实际应用中这里会调用真实的AI API）
  let answer = '';
  let confidence = 0.8;

  if (questionLower.includes('内容策略') || questionLower.includes('策略')) {
    answer = `基于对 @${username} 的推文分析，该账号采用了多元化的内容策略：

1. **技术教育导向**: 大部分内容聚焦于Web3技术解释和教程分享，帮助用户理解复杂概念。

2. **社区互动**: 积极参与社区讨论，回复用户问题，建立了良好的互动氛围。

3. **市场洞察**: 定期分享对市场趋势的观察和预测，提供有价值的分析内容。

4. **实用工具**: 经常推荐和分享实用的Web3工具和资源，为用户提供实际价值。

5. **内容多样性**: 结合文字、图片等多种形式，保持内容的丰富性和可读性。

从数据来看，平均每条推文获得 ${Math.round(avgEngagement)} 次互动，说明内容策略较为成功。`;

  } else if (questionLower.includes('受欢迎') || questionLower.includes('热门') || questionLower.includes('推文类型')) {
    const topTweet = tweets.reduce((max, current) => {
      const currentEngagement = (current.public_metrics?.like_count || 0) + 
                               (current.public_metrics?.retweet_count || 0) + 
                               (current.public_metrics?.reply_count || 0);
      const maxEngagement = (max.public_metrics?.like_count || 0) + 
                            (max.public_metrics?.retweet_count || 0) + 
                            (max.public_metrics?.reply_count || 0);
      return currentEngagement > maxEngagement ? current : max;
    }, tweets[0]);

    answer = `根据互动数据分析，@${username} 最受欢迎的推文类型包括：

1. **技术深度解析**: 对复杂技术概念的深入讲解往往获得最高的互动率。

2. **实时市场观点**: 对热门事件和市场动态的及时评论和分析。

3. **工具推荐**: 实用的Web3工具和资源分享获得很好的传播效果。

4. **社区问答**: 回答用户问题的推文通常有很高的参与度。

5. **个人观点**: 基于经验的个人见解和预测类内容。

其中表现最好的推文获得了 ${(topTweet.public_metrics?.like_count || 0) + (topTweet.public_metrics?.retweet_count || 0) + (topTweet.public_metrics?.reply_count || 0)} 次互动。`;

  } else if (questionLower.includes('时间') || questionLower.includes('什么时候')) {
    answer = `根据推文发布时间和互动数据分析，@${username} 的最佳发布时间为：

1. **工作日晚间** (19:00-22:00): 用户下班后有时间深度阅读技术内容。

2. **周末下午** (14:00-18:00): 用户有较多空闲时间参与讨论。

3. **周二和周四**: 工作日中期，用户注意力较为集中。

建议避开的时间：
- 工作日早高峰 (7:00-9:00)
- 深夜时段 (23:00以后)
- 周一早上（工作开始，注意力分散）

当前的发布策略在互动效果上表现良好，平均每条推文获得 ${Math.round(avgEngagement)} 次互动。`;

  } else if (questionLower.includes('学习') || questionLower.includes('模式') || questionLower.includes('创作')) {
    answer = `@${username} 的内容创作展现了几个值得学习的模式：

1. **一致性**: 保持稳定的发布频率和质量标准，建立读者期待。

2. **深度与广度并重**: 既有深度技术分析，也有趋势概览，满足不同层次读者需求。

3. **互动导向**: 不只是单向输出，积极回应评论，形成社区讨论。

4. **实用价值**: 每条内容都力求为读者提供实际价值，无论是知识还是工具。

5. **及时性**: 对热点事件反应迅速，保持内容的时效性和相关性。

6. **个人风格**: 保持独特的观点和表达方式，形成可识别的个人品牌。

这些模式帮助建立了忠实的读者群体和良好的互动氛围。`;

  } else {
    // 通用回答
    answer = `基于对 @${username} 的 ${tweets.length} 条推文分析，我发现了一些有趣的模式：

该账号在Web3领域表现出专业的内容输出能力，平均每条推文获得 ${Math.round(avgEngagement)} 次互动。内容主要聚焦于技术教育、市场分析和社区建设。

从互动模式来看，用户更喜欢深度的技术解析和实用的工具推荐。发布时间主要集中在工作日晚间和周末，这与目标受众的作息习惯相符。

如果您想了解更具体的分析，可以询问关于内容策略、发布时机、受众特征等方面的问题。`;
    confidence = 0.6;
  }

  return {
    answer,
    confidence,
    sources: relevantTweets.slice(0, 5).map(tweet => ({
      tweet_id: tweet.id,
      tweet_text: tweet.text,
      relevance_score: 0.8 + Math.random() * 0.2 // 模拟相关性分数
    }))
  };
}

function findRelevantTweets(question: string, tweets: any[]): any[] {
  const questionKeywords = question.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['什么', '如何', '怎么', '为什么', '哪些', '这个', '那个'].includes(word));

  // 简单的关键词匹配来找相关推文
  const scoredTweets = tweets.map(tweet => {
    const tweetText = tweet.text.toLowerCase();
    let score = 0;

    questionKeywords.forEach(keyword => {
      if (tweetText.includes(keyword)) {
        score += 1;
      }
    });

    // 考虑互动数作为权重
    const engagement = (tweet.public_metrics?.like_count || 0) + 
                      (tweet.public_metrics?.retweet_count || 0) + 
                      (tweet.public_metrics?.reply_count || 0);
    score += engagement / 100; // 归一化互动数

    return { tweet, score };
  });

  // 按分数排序并返回前几条
  return scoredTweets
    .sort((a, b) => b.score - a.score)
    .map(item => item.tweet)
    .slice(0, 10);
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