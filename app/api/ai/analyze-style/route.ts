import { NextRequest, NextResponse } from 'next/server';
import { TwitterServiceV2 } from '@/lib/services/twitter-api-v2';
import { createClient } from '@/lib/supabase/server';

interface TweetStyleAnalysis {
  tone: string;
  keywords: string[];
  avgLength: number;
  commonPatterns: string[];
  emojiUsage: boolean;
  hashtagStyle: string;
  confidenceScore: number;
}

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

    console.log(`[Style Analysis API] Starting analysis for @${username}`);

    // Initialize Twitter service
    const twitterService = new TwitterServiceV2();
    
    // Get comprehensive user data
    const analysisResult = await twitterService.getComprehensiveUserAnalysis(username);
    
    if (!analysisResult.tweets || analysisResult.tweets.length === 0) {
      return NextResponse.json({
        success: false,
        error: '无法获取该用户的推文数据，请检查用户名是否正确'
      }, { status: 404 });
    }

    console.log(`[Style Analysis] Analyzing ${analysisResult.tweets.length} tweets`);

    // Filter for high-engagement tweets (top 30% by engagement, minimum 20 tweets)
    const tweetsWithEngagement = analysisResult.tweets
      .map(tweet => ({
        ...tweet,
        engagement_score: calculateEngagementScore(
          tweet.public_metrics || {}, 
          analysisResult.user.public_metrics?.followers_count || 1000,
          tweet.created_at
        )
      }))
      .sort((a, b) => b.engagement_score - a.engagement_score);

    const topTweets = tweetsWithEngagement.slice(0, Math.min(20, Math.max(10, Math.ceil(tweetsWithEngagement.length * 0.3))));
    
    // Analyze writing style
    const styleAnalysis = analyzeWritingStyle(topTweets);
    
    // Get top performing tweets for reference
    const topTweetsForDisplay = topTweets.slice(0, 20).map(tweet => ({
      id: tweet.id,
      text: tweet.text || '',
      public_metrics: tweet.public_metrics || {
        like_count: 0,
        retweet_count: 0,
        reply_count: 0
      },
      engagement_score: tweet.engagement_score,
      created_at: tweet.created_at,
      tweet_url: tweet.tweet_url || `https://twitter.com/${username}/status/${tweet.id}`
    }));

    // Log search history
    const { error: historyError } = await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        search_type: 'style_analysis',
        search_params: { username },
        results_count: topTweets.length,
        metadata: {
          total_tweets: analysisResult.tweets.length,
          top_tweets_analyzed: topTweets.length,
          confidence_score: styleAnalysis.confidenceScore
        }
      });

    if (historyError) {
      console.warn('Failed to log search history:', historyError);
    }

    console.log(`[Style Analysis] Generated style analysis for @${username}`);

    return NextResponse.json({
      success: true,
      style: styleAnalysis,
      topTweets: topTweetsForDisplay,
      metadata: {
        username: analysisResult.user.username,
        total_tweets_analyzed: topTweets.length,
        analysis_time: new Date().toISOString(),
        confidence_score: styleAnalysis.confidenceScore
      }
    });

  } catch (error: any) {
    console.error('Style analysis API error:', error);
    
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

// Helper functions
function calculateEngagementScore(metrics: any, followerCount: number = 1000, tweetDate?: string): number {
  const likes = metrics.like_count || 0;
  const retweets = metrics.retweet_count || 0;
  const replies = metrics.reply_count || 0;
  const quotes = metrics.quote_count || 0;
  
  // Base engagement score with improved weighting
  // Replies are most valuable (indicate discussion)
  // Retweets show content sharing value
  // Quotes show thought-provoking content
  // Likes are basic appreciation
  const baseScore = (likes * 1) + (retweets * 3) + (replies * 5) + (quotes * 4);
  
  // Normalize by follower count to get engagement rate
  const engagementRate = baseScore / Math.max(followerCount, 100);
  
  // Time decay factor (newer tweets get slight boost)
  let timeFactor = 1;
  if (tweetDate) {
    const daysSincePosted = (Date.now() - new Date(tweetDate).getTime()) / (1000 * 60 * 60 * 24);
    // Slight preference for recent content (max 30 days lookback)
    timeFactor = Math.max(0.8, 1 - (daysSincePosted / 365) * 0.2);
  }
  
  // Content quality multiplier based on engagement patterns
  let qualityMultiplier = 1;
  if (replies > likes * 0.1) qualityMultiplier += 0.3; // High discussion ratio
  if (retweets > likes * 0.05) qualityMultiplier += 0.2; // High share ratio
  if (baseScore > followerCount * 0.01) qualityMultiplier += 0.2; // Above-average engagement
  
  const finalScore = (baseScore * 1000 + engagementRate * 10000) * timeFactor * qualityMultiplier;
  
  return Math.round(finalScore);
}

function analyzeWritingStyle(tweets: any[]): TweetStyleAnalysis {
  if (tweets.length === 0) {
    return {
      tone: 'neutral',
      keywords: [],
      avgLength: 0,
      commonPatterns: [],
      emojiUsage: false,
      hashtagStyle: 'minimal',
      confidenceScore: 0
    };
  }

  // Analyze average length
  const lengths = tweets.map(t => (t.text || '').length).filter(l => l > 0);
  const avgLength = lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;

  // Extract and analyze keywords
  const allText = tweets.map(t => t.text || '').join(' ').toLowerCase();
  const words = allText.match(/\b\w+\b/g) || [];
  const wordCounts: { [key: string]: number } = {};
  
  words.forEach(word => {
    if (word.length > 3 && !isStopWord(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  // Analyze emoji usage
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const totalEmojis = tweets.reduce((count, tweet) => {
    const matches = (tweet.text || '').match(emojiRegex);
    return count + (matches ? matches.length : 0);
  }, 0);
  const emojiUsage = totalEmojis > tweets.length * 0.3; // More than 30% of tweets have emojis

  // Analyze hashtag usage
  const totalHashtags = tweets.reduce((count, tweet) => {
    const matches = (tweet.text || '').match(/#\w+/g);
    return count + (matches ? matches.length : 0);
  }, 0);
  
  let hashtagStyle = 'minimal';
  const avgHashtagsPerTweet = totalHashtags / tweets.length;
  if (avgHashtagsPerTweet > 2) {
    hashtagStyle = 'heavy';
  } else if (avgHashtagsPerTweet > 0.5) {
    hashtagStyle = 'moderate';
  }

  // Determine tone based on content analysis
  const tone = determineTone(allText, tweets);

  // Identify common patterns
  const patterns = identifyCommonPatterns(tweets);

  // Calculate confidence score based on data quality
  const confidenceScore = Math.min(100, Math.max(30, 
    (tweets.length * 5) + // More tweets = higher confidence
    (keywords.length * 2) + // More keywords = higher confidence
    (patterns.length * 3) + // More patterns = higher confidence
    (avgLength > 20 ? 10 : 0) // Reasonable length tweets
  ));

  return {
    tone,
    keywords,
    avgLength,
    commonPatterns: patterns,
    emojiUsage,
    hashtagStyle,
    confidenceScore
  };
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'us', 'them', 'what',
    'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'now'
  ]);
  
  return stopWords.has(word);
}

function determineTone(text: string, tweets: any[]): string {
  const tweetTexts = tweets.map(t => t.text || '').join(' ').toLowerCase();
  const totalLength = tweetTexts.length;
  
  if (totalLength === 0) return 'neutral';

  // Enhanced technical indicators with context - expanded Web3 and security terms
  const technicalWords = [
    'blockchain', 'crypto', 'defi', 'nft', 'web3', 'protocol', 'ethereum', 'bitcoin', 
    'smart contract', 'consensus', 'validator', 'node', 'hash', 'mining', 'staking',
    'dao', 'dapp', 'metamask', 'wallet', 'gas', 'layer', 'rollup', 'bridge',
    'phishing', 'scam', 'security', 'audit', 'vulnerability', 'exploit', 'hack', 'malware',
    'token', 'airdrop', 'yield', 'liquidity', 'governance', 'oracle', 'cross-chain',
    'zk', 'zero knowledge', 'sidechain', 'mainnet', 'testnet', 'fork', 'upgrade',
    'mev', 'flashloan', 'arbitrage', 'slippage', 'sandwich', 'frontrun'
  ];
  const technicalScore = technicalWords.reduce((score, word) => {
    const matches = (tweetTexts.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
    return score + matches * (word.includes(' ') ? 2 : 1); // Multi-word terms get more weight
  }, 0) / Math.max(tweets.length, 1);

  // Professional indicators with business context
  const professionalWords = [
    'strategy', 'business', 'market', 'growth', 'investment', 'analysis', 'development', 
    'partnership', 'revenue', 'metrics', 'kpi', 'roadmap', 'milestone', 'announcement',
    'executive', 'leadership', 'management', 'enterprise', 'solution', 'client'
  ];
  const professionalScore = professionalWords.reduce((score, word) => {
    return score + (tweetTexts.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
  }, 0) / Math.max(tweets.length, 1);

  // Casual indicators with social context
  const casualWords = [
    'cool', 'awesome', 'nice', 'love', 'like', 'fun', 'enjoy', 'happy', 'great',
    'amazing', 'fantastic', 'brilliant', 'epic', 'sweet', 'dude', 'guys', 'folks',
    'hey', 'yo', 'tbh', 'imo', 'btw', 'fyi', 'gonna', 'wanna'
  ];
  const casualScore = casualWords.reduce((score, word) => {
    return score + (tweetTexts.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
  }, 0) / Math.max(tweets.length, 1);

  // Enhanced humorous indicators
  const humorEmojis = tweetTexts.match(/[😂😄😆🤣😊😎🔥💯😉😋🤔💭🎉✨🚀]/g) || [];
  const exclamations = tweetTexts.match(/!/g) || [];
  const humorSlang = tweetTexts.match(/\b(lol|haha|wow|omg|lmao|rofl|xd|hehe|oof|bruh|sus|bet|fr|no cap|based)\b/gi) || [];
  const humorousScore = (humorEmojis.length * 2 + exclamations.length * 0.3 + humorSlang.length * 3) / Math.max(tweets.length, 1);

  // Inspirational indicators with motivational context
  const inspirationalWords = [
    'future', 'vision', 'dream', 'build', 'create', 'innovate', 'change', 'believe', 
    'achieve', 'inspire', 'motivate', 'empower', 'transform', 'breakthrough', 'potential',
    'journey', 'purpose', 'mission', 'passion', 'dedication', 'perseverance', 'hope'
  ];
  const inspirationalScore = inspirationalWords.reduce((score, word) => {
    return score + (tweetTexts.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
  }, 0) / Math.max(tweets.length, 1);

  // Educational/Teaching tone
  const educationalWords = [
    'learn', 'understand', 'explain', 'tutorial', 'guide', 'tip', 'lesson', 'teach',
    'knowledge', 'education', 'study', 'research', 'discover', 'explore', 'insight',
    'how to', 'why', 'because', 'remember', 'important', 'key point'
  ];
  const educationalScore = educationalWords.reduce((score, word) => {
    return score + (tweetTexts.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
  }, 0) / Math.max(tweets.length, 1);

  // Calculate structural indicators
  const questionRatio = tweets.filter(t => (t.text || '').includes('?')).length / tweets.length;
  const threadRatio = tweets.filter(t => (t.text || '').match(/\d+\/\d+|thread|\(1\/|\[1\/|🧵/i)).length / tweets.length;
  const avgLength = tweets.reduce((sum, t) => sum + (t.text || '').length, 0) / tweets.length;
  const hashtagDensity = (tweetTexts.match(/#\w+/g) || []).length / tweets.length;

  // Adjust scores based on structural patterns
  let adjustedScores = {
    technical: technicalScore + (avgLength > 200 ? 0.5 : 0) + (hashtagDensity > 1 ? 0.3 : 0),
    professional: professionalScore + (avgLength > 150 ? 0.3 : 0) + (threadRatio > 0.1 ? 0.5 : 0),
    casual: casualScore + (avgLength < 100 ? 0.3 : 0) + (humorEmojis.length > tweets.length * 0.3 ? 0.5 : 0),
    humorous: humorousScore + (exclamations.length > tweets.length * 0.5 ? 0.5 : 0),
    inspirational: inspirationalScore + (questionRatio > 0.2 ? 0.3 : 0),
    educational: educationalScore + (questionRatio > 0.3 ? 0.5 : 0) + (threadRatio > 0.15 ? 0.3 : 0)
  };

  // Normalize scores to prevent bias towards longer content
  const totalScore = Object.values(adjustedScores).reduce((sum, score) => sum + score, 0);
  if (totalScore === 0) return 'neutral';

  // Find the dominant tone with adjusted threshold
  const maxScore = Math.max(...Object.values(adjustedScores));
  if (maxScore < 0.3) return 'neutral'; // Lowered threshold for better detection
  
  const dominantTone = Object.entries(adjustedScores).find(([, score]) => score === maxScore)?.[0];
  
  // More lenient validation: check if the tone is reasonably higher than others
  const sortedScores = Object.values(adjustedScores).sort((a, b) => b - a);
  const secondHighest = sortedScores[1] || 0;
  
  // If maxScore is more than 1.2x the second highest, or if second highest is very low, accept the result
  if (maxScore / Math.max(secondHighest, 0.1) >= 1.2 || maxScore > 1.0) {
    return dominantTone || 'neutral';
  }
  
  // If scores are too close but we have a reasonable signal, still return the dominant tone
  if (maxScore > 0.5) {
    return dominantTone || 'neutral';
  }
  
  return 'neutral';
}

function identifyCommonPatterns(tweets: any[]): string[] {
  const patterns = [];
  
  // Question pattern
  const questionTweets = tweets.filter(t => (t.text || '').includes('?')).length;
  if (questionTweets > tweets.length * 0.2) {
    patterns.push('经常使用提问式开头');
  }

  // Thread pattern
  const threadTweets = tweets.filter(t => (t.text || '').match(/\d+\/\d+|thread/i)).length;
  if (threadTweets > tweets.length * 0.1) {
    patterns.push('喜欢发布推文串');
  }

  // Quote pattern
  const quoteTweets = tweets.filter(t => (t.text || '').includes('"')).length;
  if (quoteTweets > tweets.length * 0.15) {
    patterns.push('经常引用他人观点');
  }

  // Link sharing pattern
  const linkTweets = tweets.filter(t => (t.text || '').match(/https?:\/\//)).length;
  if (linkTweets > tweets.length * 0.3) {
    patterns.push('频繁分享链接内容');
  }

  // Technical discussion pattern
  const techTweets = tweets.filter(t => (t.text || '').match(/\b(build|deploy|code|dev|tech|protocol)\b/i)).length;
  if (techTweets > tweets.length * 0.2) {
    patterns.push('专注技术讨论');
  }

  return patterns;
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