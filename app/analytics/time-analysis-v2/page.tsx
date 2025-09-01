"use client";

import { useState, useEffect } from "react";
import { AccountSelector } from "@/components/account-selector";

// Import Tweet type from context
type Tweet = {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  author_id?: string;
  engagement_score?: number;
  media?: any[];
  has_media?: boolean;
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3Icon,
  TableIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  RefreshCwIcon,
  MessageCircleIcon
} from "lucide-react";
import Link from "next/link";
import { ClientAuthButton } from "@/components/client-auth-button";
import MaximizedTwitterCache from "@/lib/cache-v2";
import Web3AnalysisReport from "@/components/web3-analysis-report";
import AIQuestionAnswer from "@/components/ai-question-answer";

interface DetailedTimeAnalysis {
  period: string;
  displayName: string;
  startDate: string;
  endDate: string;
  totalTweets: number;
  mediaTweets: number;
  engagement: {
    totalLikes: number;
    totalRetweets: number;
    totalReplies: number;
    totalEngagement: number;
    avgEngagement: number;
    engagementRate: number;
    topPerformingTweet: {
      id: string;
      text: string;
      likes: number;
      retweets: number;
      url: string;
    } | null;
  };
  content: {
    avgLength: number;
    topHashtags: Array<{ tag: string; count: number }>;
    languages: Array<{ lang: string; count: number; percentage: number }>;
    mediaTypes: Array<{ type: string; count: number; percentage: number }>;
  };
  timing: {
    mostActiveHour: number;
    mostActiveDay: string;
    distributionByHour: Array<{ hour: number; count: number }>;
    distributionByDay: Array<{ day: string; count: number }>;
  };
  trends: {
    comparedToPrevious: 'up' | 'down' | 'stable' | 'new';
    growthPercentage: number;
    insights: string[];
    recommendations: string[];
  };
  followerGrowth: number;
  followerGrowthRate: number;
  bestPostingTime: string;
}

interface ComprehensiveAccountData {
  username: string;
  name: string;
  description: string;
  profileImage: string;
  metrics: {
    followers: number;
    following: number;
    totalTweets: number;
    accountAge: number;
  };
  collectionStats: {
    tweetsCollected: number;
    timeSpanDays: number;
    oldestTweetDate: string;
    newestTweetDate: string;
    collectionTime: string;
  };
}

export default function TimeAnalysisV2Page() {
  const [mounted, setMounted] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [accountData, setAccountData] = useState<ComprehensiveAccountData | null>(null);
  const [timeAnalysis, setTimeAnalysis] = useState<DetailedTimeAnalysis[]>([]);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AI分析相关状态
  const [contentClassification, setContentClassification] = useState<any>(null);
  const [keywordTrends, setKeywordTrends] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  
  // 数据收集相关状态
  const [newAccountUsername, setNewAccountUsername] = useState<string>('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionProgress, setCollectionProgress] = useState('');
  const [collectionPercentage, setCollectionPercentage] = useState(0);
  const [collectionStats, setCollectionStats] = useState<{
    totalTweets: number;
    pagesProcessed: number;
    timeSpanDays: number;
  }>({ totalTweets: 0, pagesProcessed: 0, timeSpanDays: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // 当选择账号时自动加载数据
  useEffect(() => {
    if (selectedAccount && mounted) {
      loadUserDataFromDatabase(selectedAccount);
    }
  }, [selectedAccount, mounted]);

  // 从数据库加载用户数据
  const loadUserDataFromDatabase = async (usernameToLoad: string) => {
    if (!usernameToLoad) return;

    try {
      setIsLoading(true);
      setError(null);
      setAccountData(null);

      const response = await fetch(`/api/twitter/get-user-data?username=${encodeURIComponent(usernameToLoad)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取数据失败');
      }

      if (data.success && data.data) {
        const userData = data.data;
        const userStats = userData.user;
        const tweets = userData.tweets;
        
        // 创建兼容的账户数据
        const accountCreatedAt = userStats.account_created_at ? new Date(userStats.account_created_at) : new Date();
        const accountAge = Math.floor((new Date().getTime() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        const databaseAccountData: ComprehensiveAccountData = {
          username: usernameToLoad,
          name: userStats.display_name || usernameToLoad,
          description: userStats.description || '',
          profileImage: userStats.profile_image_url || '',
          metrics: {
            followers: userStats.followers_count || 0,
            following: userStats.following_count || 0,
            totalTweets: userStats.tweet_count || tweets.length,
            accountAge: accountAge
          },
          collectionStats: {
            tweetsCollected: tweets.length,
            timeSpanDays: userStats.earliest_tweet_date && userStats.latest_tweet_date ? 
              Math.ceil((new Date(userStats.latest_tweet_date).getTime() - new Date(userStats.earliest_tweet_date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
            oldestTweetDate: userStats.earliest_tweet_date || '',
            newestTweetDate: userStats.latest_tweet_date || '',
            collectionTime: new Date().toISOString()
          }
        };

        setAccountData(databaseAccountData);
        
        // 生成时间分析
        const analysis = generateDetailedTimeAnalysis(tweets, viewMode);
        setTimeAnalysis(analysis);
        
        // 自动执行AI分析
        if (tweets && tweets.length > 0) {
          performAIAnalysis(tweets, username);
        }
      } else {
        throw new Error('数据格式错误');
      }
    } catch (error: any) {
      console.error('Error loading user data from database:', error);
      setError(error.message || '加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountSelect = (username: string) => {
    setSelectedAccount(username);
  };

  const handleRefreshAccounts = () => {
    // 刷新账号列表的逻辑会在 AccountSelector 组件内部处理
  };

  // AI内容分类分析
  const analyzeContentClassification = async (tweets: Tweet[], username: string) => {
    if (!tweets || tweets.length === 0) return;

    try {
      setAnalysisProgress('正在分析推文内容分类...');
      
      const response = await fetch('/api/ai/content-classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tweets: tweets,
          username: username 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('AI content classification failed:', data);
        throw new Error(data.error || 'AI分类分析失败');
      }

      if (data.success) {
        setContentClassification(data.data);
        console.log('Content classification completed:', data.data);
      } else {
        throw new Error('AI分析返回失败状态');
      }
    } catch (error: any) {
      console.error('Content classification error:', error);
      setContentClassification(null);
      throw error; // 重新抛出错误，让上级函数处理
    }
  };

  // 关键词趋势分析
  const analyzeKeywordTrends = async (tweets: Tweet[], username: string) => {
    if (!tweets || tweets.length === 0) return;

    try {
      setAnalysisProgress('正在分析热门关键词和趋势...');
      
      const response = await fetch('/api/ai/keyword-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tweets: tweets,
          username: username 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('AI keyword trends failed:', data);
        throw new Error(data.error || '关键词趋势分析失败');
      }

      if (data.success) {
        setKeywordTrends(data.data);
        console.log('Keyword trends completed:', data.data);
      } else {
        throw new Error('关键词分析返回失败状态');
      }
    } catch (error: any) {
      console.error('Keyword trends error:', error);
      setKeywordTrends(null);
      throw error; // 重新抛出错误，让上级函数处理
    }
  };

  // 执行全部AI分析
  const performAIAnalysis = async (tweets?: any[], username?: string) => {
    const targetTweets = tweets || accountData?.tweets;
    const targetUsername = username || accountData?.username;
    
    if (!targetTweets || targetTweets.length === 0) {
      console.log('No tweets available for AI analysis');
      return;
    }

    if (!targetUsername) {
      console.log('No username available for AI analysis');
      return;
    }

    console.log(`Starting AI analysis for ${targetTweets.length} tweets of @${targetUsername}`);
    
    setIsAnalyzing(true);
    setAnalysisProgress('开始AI分析...');
    
    try {
      // 串行执行分析，避免并发问题
      setAnalysisProgress('正在分析推文内容分类...');
      await analyzeContentClassification(targetTweets, targetUsername);
      
      setAnalysisProgress('正在分析热门关键词和趋势...');
      await analyzeKeywordTrends(targetTweets, targetUsername);
      
      setAnalysisProgress('✅ AI分析完成！');
      console.log('AI analysis completed successfully');
      
      setTimeout(() => {
        setAnalysisProgress('');
      }, 3000);
    } catch (error: any) {
      console.error('AI analysis failed:', error);
      setAnalysisProgress(`❌ AI分析失败: ${error.message}`);
      
      setTimeout(() => {
        setAnalysisProgress('');
      }, 8000);
    } finally {
      setIsAnalyzing(false);
    }
  };


  const loadCacheData = () => {
    if (!MaximizedTwitterCache.isValid()) return;

    const cacheStats = MaximizedTwitterCache.getCacheStats();
    if (cacheStats && cacheStats.accounts.length > 0) {
      // 默认选择第一个账号
      const firstAccount = cacheStats.accounts[0].username;
      setSelectedAccount(firstAccount);
      loadAccountAnalysis(firstAccount);
    }
  };

  const loadAccountAnalysis = (username: string) => {
    const accountData = MaximizedTwitterCache.getAccountData(username);
    if (!accountData) return;

    // 转换账号数据
    const comprehensiveData: ComprehensiveAccountData = {
      username: accountData.user.username,
      name: accountData.user.name,
      description: accountData.user.description,
      profileImage: accountData.user.profile_image_url,
      metrics: {
        followers: accountData.user.public_metrics.followers_count,
        following: accountData.user.public_metrics.following_count,
        totalTweets: accountData.user.public_metrics.tweet_count,
        accountAge: Math.round((Date.now() - new Date(accountData.user.created_at).getTime()) / (365 * 24 * 60 * 60 * 1000))
      },
      collectionStats: {
        tweetsCollected: accountData.tweets.length,
        timeSpanDays: accountData.collectionMetadata.timeSpanDays,
        oldestTweetDate: accountData.collectionMetadata.oldestTweetDate || '',
        newestTweetDate: accountData.collectionMetadata.newestTweetDate || '',
        collectionTime: accountData.collectionMetadata.collectionTime
      }
    };

    setAccountData(comprehensiveData);

    // 生成时间分析
    const analysis = generateDetailedTimeAnalysis(accountData.tweets, viewMode);
    setTimeAnalysis(analysis);
  };

  const generateDetailedTimeAnalysis = (tweets: any[], mode: string): DetailedTimeAnalysis[] => {
    if (tweets.length === 0) return [];

    // 按时间排序推文
    const sortedTweets = tweets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 根据模式分组
    const groups = groupTweetsByPeriod(sortedTweets, mode);

    return groups.map((group, index) => {
      const engagement = calculateEngagementStats(group.tweets);
      const content = analyzeContentStats(group.tweets);
      const timing = analyzeTiming(group.tweets);
      const trends = calculateTrends(group.tweets, groups[index + 1]?.tweets || []);

      return {
        period: group.period,
        displayName: group.displayName,
        startDate: group.startDate,
        endDate: group.endDate,
        totalTweets: group.tweets.length,
        mediaTweets: group.tweets.filter(t => t.has_media).length,
        engagement,
        content,
        timing,
        trends,
        followerGrowth: calculateFollowerGrowth(group.tweets, accountData),
        followerGrowthRate: calculateFollowerGrowthRate(group.tweets, accountData),
        bestPostingTime: timing.mostActiveHour < 12 
          ? `上午${timing.mostActiveHour}点` 
          : timing.mostActiveHour === 12 
            ? `下午12点`
            : `下午${timing.mostActiveHour - 12}点`
      };
    });
  };

  const groupTweetsByPeriod = (tweets: any[], mode: string) => {
    const groups: any[] = [];
    const now = new Date();

    if (mode === 'monthly') {
      // 按月分组
      for (let i = 0; i < 12; i++) {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        const monthTweets = tweets.filter(tweet => {
          const tweetDate = new Date(tweet.created_at);
          return tweetDate >= startDate && tweetDate <= endDate;
        });

        if (monthTweets.length > 0) {
          groups.push({
            period: `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`,
            displayName: `${startDate.getFullYear()}年${startDate.getMonth() + 1}月`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            tweets: monthTweets
          });
        }
      }
    } else if (mode === 'weekly') {
      // 按周分组
      for (let i = 0; i < 12; i++) {
        const startDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate.getTime() + (6 * 24 * 60 * 60 * 1000));
        endDate.setHours(23, 59, 59, 999);

        const weekTweets = tweets.filter(tweet => {
          const tweetDate = new Date(tweet.created_at);
          return tweetDate >= startDate && tweetDate <= endDate;
        });

        if (weekTweets.length > 0) {
          groups.push({
            period: `week-${i}`,
            displayName: `第${i + 1}周 (${startDate.getMonth() + 1}/${startDate.getDate()})`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            tweets: weekTweets
          });
        }
      }
    } else if (mode === 'yearly') {
      // 按年分组
      for (let i = 0; i < 5; i++) {
        const year = now.getFullYear() - i;
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);

        const yearTweets = tweets.filter(tweet => {
          const tweetDate = new Date(tweet.created_at);
          return tweetDate.getFullYear() === year;
        });

        if (yearTweets.length > 0) {
          groups.push({
            period: year.toString(),
            displayName: `${year}年`,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            tweets: yearTweets
          });
        }
      }
    }

    return groups;
  };

  const calculateEngagementStats = (tweets: any[]) => {
    if (tweets.length === 0) {
      return {
        totalLikes: 0,
        totalRetweets: 0,
        totalReplies: 0,
        avgEngagement: 0,
        topPerformingTweet: null
      };
    }

    const totalLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || t.like_count || 0), 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || t.retweet_count || 0), 0);
    const totalReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || t.reply_count || 0), 0);
    const avgEngagement = tweets.length > 0 ? Math.round((totalLikes + totalRetweets + totalReplies) / tweets.length) : 0;

    // 找出最高参与度的推文
    const topTweet = tweets.reduce((max, current) => {
      const currentEngagement = (current.public_metrics?.like_count || current.like_count || 0) + 
                               (current.public_metrics?.retweet_count || current.retweet_count || 0) + 
                               (current.public_metrics?.reply_count || current.reply_count || 0);
      const maxEngagement = (max.public_metrics?.like_count || max.like_count || 0) + 
                            (max.public_metrics?.retweet_count || max.retweet_count || 0) + 
                            (max.public_metrics?.reply_count || max.reply_count || 0);
      return currentEngagement > maxEngagement ? current : max;
    }, tweets[0]);

    const totalEngagement = totalLikes + totalRetweets + totalReplies;
    const totalImpressions = tweets.reduce((sum, t) => sum + (t.public_metrics?.impression_count || t.impression_count || totalEngagement * 10), 0);
    const engagementRate = totalImpressions > 0 ? Number(((totalEngagement / totalImpressions) * 100).toFixed(1)) : 0;

    return {
      totalLikes,
      totalRetweets,
      totalReplies,
      totalEngagement,
      avgEngagement,
      engagementRate,
      topPerformingTweet: topTweet ? {
        id: topTweet.id,
        text: topTweet.text.substring(0, 100) + (topTweet.text.length > 100 ? '...' : ''),
        likes: topTweet.public_metrics?.like_count || topTweet.like_count || 0,
        retweets: topTweet.public_metrics?.retweet_count || topTweet.retweet_count || 0,
        url: topTweet.tweet_url || '#'
      } : null
    };
  };

  const analyzeContentStats = (tweets: any[]) => {
    if (tweets.length === 0) {
      return {
        avgLength: 0,
        topHashtags: [],
        languages: [],
        mediaTypes: []
      };
    }

    // 平均长度
    const avgLength = Math.round(tweets.reduce((sum, t) => sum + t.text.length, 0) / tweets.length);

    // 统计标签
    const hashtagCount: { [key: string]: number } = {};
    tweets.forEach(tweet => {
      if (tweet.entities?.hashtags) {
        tweet.entities.hashtags.forEach((hashtag: any) => {
          const tag = hashtag.tag.toLowerCase();
          hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
        });
      }
    });

    const topHashtags = Object.entries(hashtagCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag: `#${tag}`, count }));

    // 统计语言
    const langCount: { [key: string]: number } = {};
    tweets.forEach(tweet => {
      const lang = tweet.lang || 'unknown';
      langCount[lang] = (langCount[lang] || 0) + 1;
    });

    const languages = Object.entries(langCount)
      .sort(([, a], [, b]) => b - a)
      .map(([lang, count]) => ({
        lang,
        count,
        percentage: Math.round((count / tweets.length) * 100)
      }));

    // 统计媒体类型
    const mediaCount: { [key: string]: number } = {};
    tweets.forEach(tweet => {
      if (tweet.media && tweet.media.length > 0) {
        tweet.media.forEach((media: any) => {
          mediaCount[media.type] = (mediaCount[media.type] || 0) + 1;
        });
      }
    });

    const totalMedia = Object.values(mediaCount).reduce((sum, count) => sum + count, 0);
    const mediaTypes = Object.entries(mediaCount)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalMedia > 0 ? Math.round((count / totalMedia) * 100) : 0
      }));

    return {
      avgLength,
      topHashtags,
      languages,
      mediaTypes
    };
  };

  const analyzeTiming = (tweets: any[]) => {
    if (tweets.length === 0) {
      return {
        mostActiveHour: 0,
        mostActiveDay: '',
        distributionByHour: [],
        distributionByDay: []
      };
    }

    // 按小时分布
    const hourCount: { [key: number]: number } = {};
    const dayCount: { [key: string]: number } = {};

    tweets.forEach(tweet => {
      const date = new Date(tweet.created_at);
      const hour = date.getHours();
      const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];

      hourCount[hour] = (hourCount[hour] || 0) + 1;
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    const mostActiveHour = Object.entries(hourCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '0';

    const mostActiveDay = Object.entries(dayCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '';

    const distributionByHour = Object.entries(hourCount)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);

    const distributionByDay = Object.entries(dayCount)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count);

    return {
      mostActiveHour: parseInt(mostActiveHour),
      mostActiveDay,
      distributionByHour,
      distributionByDay
    };
  };

  const calculateTrends = (currentTweets: any[], previousTweets: any[]) => {
    if (previousTweets.length === 0) {
      return {
        comparedToPrevious: 'new' as const,
        growthPercentage: 0,
        insights: ['这是首个分析周期的数据'],
        recommendations: ['继续收集数据以获得趋势分析']
      };
    }

    const currentEngagement = currentTweets.reduce((sum, t) => 
      sum + (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0), 0);
    const previousEngagement = previousTweets.reduce((sum, t) => 
      sum + (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0), 0);

    const avgCurrentEngagement = currentEngagement / currentTweets.length;
    const avgPreviousEngagement = previousEngagement / previousTweets.length;

    const growthPercentage = previousTweets.length > 0 ? 
      Math.round(((avgCurrentEngagement - avgPreviousEngagement) / avgPreviousEngagement) * 100) : 0;

    let comparedToPrevious: 'up' | 'down' | 'stable';
    if (Math.abs(growthPercentage) < 5) {
      comparedToPrevious = 'stable';
    } else if (growthPercentage > 0) {
      comparedToPrevious = 'up';
    } else {
      comparedToPrevious = 'down';
    }

    const insights = generateInsights(currentTweets, previousTweets, growthPercentage);
    const recommendations = generateRecommendations(currentTweets, comparedToPrevious);

    return {
      comparedToPrevious,
      growthPercentage,
      insights,
      recommendations
    };
  };

  const generateInsights = (current: any[], previous: any[], growth: number): string[] => {
    const insights = [];

    if (growth > 20) {
      insights.push('参与度显著提升，内容策略效果良好');
    } else if (growth < -20) {
      insights.push('参与度下降明显，需要调整内容策略');
    }

    const currentMediaRate = (current.filter(t => t.has_media).length / current.length) * 100;
    const previousMediaRate = previous.length > 0 ? 
      (previous.filter(t => t.has_media).length / previous.length) * 100 : 0;

    if (currentMediaRate > previousMediaRate + 10) {
      insights.push('媒体内容占比增加，视觉化策略见效');
    }

    if (current.length > previous.length * 1.5) {
      insights.push('发文频率显著增加');
    } else if (current.length < previous.length * 0.7) {
      insights.push('发文频率有所下降');
    }

    return insights.length > 0 ? insights : ['数据变化平稳，保持现有策略'];
  };

  const generateRecommendations = (tweets: any[], trend: string): string[] => {
    const recommendations = [];

    const mediaRate = (tweets.filter(t => t.has_media).length / tweets.length) * 100;
    if (mediaRate < 30) {
      recommendations.push('建议增加视觉内容（图片、视频）比例');
    }

    if (trend === 'down') {
      recommendations.push('考虑增加互动性内容，如问答、投票等');
      recommendations.push('分析高参与度推文的共同特征');
    }

    const avgLength = tweets.reduce((sum, t) => sum + t.text.length, 0) / tweets.length;
    if (avgLength > 200) {
      recommendations.push('考虑使用更简洁的表达方式');
    } else if (avgLength < 80) {
      recommendations.push('可以提供更丰富的内容细节');
    }

    return recommendations.length > 0 ? recommendations : ['保持当前内容策略'];
  };

  const collectNewAccountData = async () => {
    if (!newAccountUsername.trim()) return;

    // 清理用户名：移除开头的@符号，只保留用户名
    const cleanUsername = newAccountUsername.trim().replace(/^@+/, '');
    if (!cleanUsername) {
      setCollectionProgress('❌ 请输入有效的用户名');
      setTimeout(() => {
        setIsCollecting(false);
        setCollectionProgress('');
      }, 3000);
      return;
    }

    setIsCollecting(true);
    setCollectionProgress('初始化数据收集...');
    setCollectionPercentage(10);
    setCollectionStats({ totalTweets: 0, pagesProcessed: 0, timeSpanDays: 0 });

    try {
      setCollectionProgress('🔍 验证用户账号信息...');
      setCollectionPercentage(20);

      const response = await fetch('/api/twitter/maximize-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to collect data');
      }

      setCollectionProgress('📊 正在收集推文数据...');
      setCollectionPercentage(50);

      const data = await response.json();
      
      if (data.success) {
        setCollectionProgress('💾 保存数据到缓存...');
        setCollectionPercentage(80);
        
        // 更新收集统计
        setCollectionStats({
          totalTweets: data.data.tweets.length,
          pagesProcessed: data.data.collection_metadata.pagesProcessed || 0,
          timeSpanDays: data.data.stats.timeSpan.days || 0
        });

        // 保存到缓存
        MaximizedTwitterCache.setAccountData(data.data.user.username, {
          user: data.data.user,
          tweets: data.data.tweets,
          stats: data.data.stats,
          collectionMetadata: {
            ...data.data.collection_metadata,
            collectionTime: new Date().toISOString(),
            apiVersion: 'v2_maximum_collection'
          }
        });

        setCollectionProgress(`✅ 数据收集完成！成功收集 ${data.data.tweets.length} 条推文，时间跨度 ${data.data.stats.timeSpan.days} 天`);
        setCollectionPercentage(100);
        
        // 切换到新收集的账号
        setSelectedAccount(data.data.user.username);
        loadAccountAnalysis(data.data.user.username);
        setNewAccountUsername('');
        
        console.log(`[TimeAnalysisV2] Data collection completed for @${data.data.user.username}:`, {
          tweets: data.data.tweets.length,
          timeSpan: data.data.stats.timeSpan.days,
          cached: true
        });
        
        setTimeout(() => {
          setIsCollecting(false);
          setCollectionProgress('');
          setCollectionPercentage(0);
          setCollectionStats({ totalTweets: 0, pagesProcessed: 0, timeSpanDays: 0 });
        }, 3000);
      } else {
        throw new Error(data.error || 'Collection failed');
      }
    } catch (error: any) {
      // 检查是否是速率限制错误，并尝试获取已收集的数据
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        setCollectionProgress(`⚠️ 遇到速率限制，但已收集的数据已保存。请稍后重试获取更多数据。`);
      } else if (error.message.includes('not found') || error.message.includes('suspended')) {
        setCollectionProgress(`❌ 用户不存在或已被暂停: ${error.message}`);
      } else {
        setCollectionProgress(`❌ 收集失败: ${error.message}`);
      }
      
      setTimeout(() => {
        setIsCollecting(false);
        setCollectionProgress('');
        setCollectionPercentage(0);
        setCollectionStats({ totalTweets: 0, pagesProcessed: 0, timeSpanDays: 0 });
        // 重新加载缓存数据，可能有部分数据已经保存
        loadCacheData();
      }, 5000);
    }
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num == null || num === undefined) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // 基于推文参与度估算粉丝增长
  const calculateFollowerGrowth = (tweets: any[], accountData: any): number => {
    if (!tweets || tweets.length === 0 || !accountData) return 0;
    
    const totalEngagement = tweets.reduce((sum, tweet) => {
      const likes = tweet.public_metrics?.like_count || tweet.like_count || 0;
      const retweets = tweet.public_metrics?.retweet_count || tweet.retweet_count || 0;
      const replies = tweet.public_metrics?.reply_count || tweet.reply_count || 0;
      return sum + likes + retweets + replies;
    }, 0);
    
    // 根据参与度和推文数量估算粉丝增长
    // 高参与度通常带来粉丝增长，这是一个简化的估算公式
    const avgEngagementPerTweet = totalEngagement / tweets.length;
    const currentFollowers = accountData.followers_count || 0;
    
    // 估算公式：根据参与度比例计算增长
    const engagementRate = currentFollowers > 0 ? (avgEngagementPerTweet / currentFollowers) : 0;
    const estimatedGrowth = Math.round(tweets.length * engagementRate * 100);
    
    // 限制增长范围在合理区间内
    return Math.max(-Math.round(currentFollowers * 0.05), Math.min(estimatedGrowth, Math.round(currentFollowers * 0.1)));
  };

  // 计算粉丝增长率
  const calculateFollowerGrowthRate = (tweets: any[], accountData: any): number => {
    if (!accountData) return 0;
    
    const growth = calculateFollowerGrowth(tweets, accountData);
    const currentFollowers = accountData.followers_count || 1; // 避免除以0
    
    const growthRate = (growth / currentFollowers) * 100;
    return Number(growthRate.toFixed(1));
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const getCacheStats = () => {
    return MaximizedTwitterCache.getCacheStats();
  };

  if (!mounted) {
    return <div className="container mx-auto p-6">加载中...</div>;
  }

  const cacheStats = getCacheStats();

  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"}>Twitter Analytics Pro</Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">推特数据分析</span>
            </div>
            <ClientAuthButton />
          </div>
        </nav>
        
        <div className="container mx-auto p-6 space-y-6 max-w-5xl">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">推特数据深度分析</h1>
            <p className="text-muted-foreground">基于数据库数据进行详细时间维度分析</p>
          </div>

          {/* Account Selector */}
          <AccountSelector
            selectedAccount={selectedAccount}
            onAccountSelect={handleAccountSelect}
            onRefreshAccounts={handleRefreshAccounts}
            title="数据分析"
            description="选择要分析的账号，查看详细的时间维度分析"
          />

          {/* Data Collection Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCwIcon className="h-5 w-5" />
                收集新账号数据
              </CardTitle>
              <CardDescription>
                输入Twitter用户名以收集最新数据进行分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="输入用户名（如：elonmusk）"
                    value={newAccountUsername}
                    onChange={(e) => setNewAccountUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                    disabled={isCollecting}
                  />
                </div>
                <button
                  onClick={collectNewAccountData}
                  disabled={isCollecting || !newAccountUsername.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCollecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      收集中...
                    </>
                  ) : (
                    <>
                      <RefreshCwIcon className="h-4 w-4" />
                      开始收集
                    </>
                  )}
                </button>
              </div>
              
              {/* Collection Progress */}
              {collectionProgress && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="space-y-3">
                    {/* Progress Text */}
                    <div className="flex items-center gap-2">
                      {isCollecting && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      )}
                      <span className="text-sm font-medium">{collectionProgress}</span>
                    </div>
                    
                    {/* Progress Bar */}
                    {isCollecting && (
                      <div className="space-y-2">
                        <Progress value={collectionPercentage} className="w-full" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{collectionPercentage}%</span>
                          <span>
                            {collectionStats.totalTweets > 0 && `${collectionStats.totalTweets} 条推文`}
                            {collectionStats.pagesProcessed > 0 && ` | ${collectionStats.pagesProcessed} 页`}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Collection Stats */}
                    {isCollecting && collectionStats.totalTweets > 0 && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                        <div className="text-center">
                          <div className="text-sm font-semibold text-blue-600">{collectionStats.totalTweets}</div>
                          <div className="text-xs text-muted-foreground">推文数</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold text-green-600">{collectionStats.pagesProcessed}</div>
                          <div className="text-xs text-muted-foreground">页数</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold text-purple-600">{collectionStats.timeSpanDays}</div>
                          <div className="text-xs text-muted-foreground">天数</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loading indicator */}
          {isLoading && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">正在加载分析数据...</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error display */}
          {error && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-red-600">
                  <p>❌ {error}</p>
                </div>
              </CardContent>
            </Card>
          )}

      {/* 账号概览 */}
      {accountData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <img 
                src={accountData.profileImage} 
                alt={accountData.name}
                className="w-12 h-12 rounded-full"
              />
              <div>
                <h2 className="text-xl">{accountData.name}</h2>
                <p className="text-muted-foreground">@{accountData.username}</p>
              </div>
            </CardTitle>
            <CardDescription>
              {accountData.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatNumber(accountData.metrics.followers)}</div>
                <div className="text-sm text-muted-foreground">粉丝数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatNumber(accountData.metrics.totalTweets)}</div>
                <div className="text-sm text-muted-foreground">总推文数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{formatNumber(accountData.collectionStats.tweetsCollected)}</div>
                <div className="text-sm text-muted-foreground">已收集</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{accountData.collectionStats.timeSpanDays}</div>
                <div className="text-sm text-muted-foreground">天跨度</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{accountData.metrics.accountAge}</div>
                <div className="text-sm text-muted-foreground">账号年龄</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分析模式选择 */}
      {accountData && (
        <Card>
          <CardHeader>
            <CardTitle>分析维度</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={viewMode} onValueChange={(value: any) => {
              setViewMode(value);
              if (selectedAccount) {
                loadAccountAnalysis(selectedAccount);
              }
            }}>
              <TabsList>
                <TabsTrigger value="yearly">年度分析</TabsTrigger>
                <TabsTrigger value="monthly">月度分析</TabsTrigger>
                <TabsTrigger value="weekly">周度分析</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Web3运营分析 */}
      {accountData && (
        <Tabs defaultValue="web3-analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="web3-analysis" className="flex items-center gap-2">
              <BarChart3Icon className="w-4 h-4" />
              Web3运营分析
            </TabsTrigger>
            <TabsTrigger value="ai-qa" className="flex items-center gap-2">
              <MessageCircleIcon className="w-4 h-4" />
              AI智能问答
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="web3-analysis" className="mt-6">
            <Web3AnalysisReport 
              tweetData={MaximizedTwitterCache.getAccountData(selectedAccount)?.tweets || []}
              username={accountData.username}
            />
          </TabsContent>
          
          <TabsContent value="ai-qa" className="mt-6">
            <AIQuestionAnswer 
              tweetData={MaximizedTwitterCache.getAccountData(selectedAccount)?.tweets || []}
              username={accountData.username}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* 详细时间分析表格 */}
      {timeAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  详细时间分析表格
                </CardTitle>
                <CardDescription>
                  展开显示每个时间周期的详细运营数据和AI分析结果
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {analysisProgress && (
                  <span className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    {isAnalyzing && <RefreshCwIcon className="h-4 w-4 animate-spin" />}
                    {analysisProgress}
                  </span>
                )}
                {!analysisProgress && (
                  <span className="text-sm text-muted-foreground">🤖 AI自动分析中...</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[1200px]">
                {/* 响应式表头 */}
                <div className="overflow-hidden">
                  {/* 桌面版表头 */}
                  <div className="hidden xl:grid xl:grid-cols-[160px_180px_180px_160px_160px_160px_160px_200px] bg-gradient-to-r from-primary/5 to-primary/10 border border-border/50 rounded-t-lg">
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      📅 时间周期
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      📊 内容统计
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      💬 参与度分析
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      🤖 AI内容分类
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      📈 粉丝增长
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      🔥 热门关键词
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary border-r border-border/30 flex items-center justify-center">
                      📈 趋势对比
                    </div>
                    <div className="p-3 text-sm font-semibold text-primary flex items-center justify-center">
                      🎯 最佳表现
                    </div>
                  </div>

                  {/* 移动版提示 */}
                  <div className="xl:hidden bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                      <span>📱</span>
                      <span>在小屏幕上，表格将以卡片形式显示以获得更好的体验</span>
                    </div>
                  </div>
                </div>

                {/* 桌面版表体 */}
                {timeAnalysis.map((period, index) => (
                  <div key={period.period}>
                    {/* 桌面版行 */}
                    <div 
                      className={`hidden xl:grid xl:grid-cols-[160px_180px_180px_160px_160px_160px_160px_200px] border-x border-b border-border/50 hover:bg-muted/20 transition-colors ${
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/5'
                      }`}
                    >
                      {/* 时间周期 */}
                      <div className="p-3 flex items-center justify-center">
                        <div className="text-center">
                          <div className="font-semibold text-primary">{period.displayName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {period.totalTweets} 推文
                          </div>
                        </div>
                      </div>

                      {/* 内容统计 */}
                      <div className="p-3 space-y-2 border-r border-border/30">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">推文数:</span>
                          <span className="font-medium text-blue-600">{period.totalTweets}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">平均长度:</span>
                          <span className="font-medium">{period.content.avgLength} 字符</span>
                        </div>
                        <div className="mt-3">
                          <div className="text-xs text-muted-foreground mb-1">热门标签:</div>
                          <div className="flex flex-wrap gap-1">
                            {period.content.topHashtags.slice(0, 3).map((hashtag) => (
                              <Badge key={hashtag.tag} variant="outline" className="text-xs">
                                {hashtag.tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 参与度分析 */}
                      <div className="p-3 space-y-2 border-r border-border/30">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">总互动:</span>
                          <span className="font-medium text-green-600">{formatNumber(period.engagement.totalEngagement)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">平均互动:</span>
                          <span className="font-medium">{formatNumber(period.engagement.avgEngagement)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-sm">互动率:</span>
                          <span className="font-medium text-orange-600">{period.engagement.engagementRate}%</span>
                        </div>
                      </div>

                      {/* AI内容分类 */}
                      <div className="p-3 border-r border-border/30">
                        {contentClassification ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground mb-2">🤖 内容分类:</div>
                            <div className="space-y-1">
                              {Object.entries(contentClassification.summary).slice(0, 4).map(([category, count]) => (
                                <div key={category} className="flex justify-between">
                                  <span className="text-muted-foreground text-xs">{category}:</span>
                                  <span className="font-medium text-purple-600">{count as number}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center py-4">
                            <div>🤖 AI分析中...</div>
                            <div>请稍候</div>
                          </div>
                        )}
                      </div>

                      {/* 粉丝增长 */}
                      <div className="p-3 border-r border-border/30">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-sm">增长数:</span>
                            <span className={`font-medium ${
                              period.followerGrowth > 0 ? 'text-green-600' : period.followerGrowth < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {period.followerGrowth > 0 ? '+' : ''}{formatNumber(period.followerGrowth)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground text-sm">增长率:</span>
                            <span className={`font-medium ${
                              period.followerGrowthRate > 0 ? 'text-green-600' : period.followerGrowthRate < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {period.followerGrowthRate > 0 ? '+' : ''}{period.followerGrowthRate}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 热门关键词 */}
                      <div className="p-3 border-r border-border/30">
                        {keywordTrends ? (
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground mb-2">🔥 热门关键词:</div>
                            <div className="space-y-1">
                              {keywordTrends.trending_keywords.slice(0, 4).map((keyword: any, i: number) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-muted-foreground text-xs">{keyword.keyword}:</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium text-orange-600">{keyword.frequency}</span>
                                    <span className="text-xs text-green-600">({keyword.avg_engagement})</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center py-4">
                            <div>🔥 分析中...</div>
                            <div>请稍候</div>
                          </div>
                        )}
                      </div>

                      {/* 趋势对比 */}
                      <div className="p-3 border-r border-border/30">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {period.trends.comparedToPrevious === 'up' && (
                              <>
                                <TrendingUpIcon className="h-4 w-4 text-green-500" />
                                <span className="text-green-600 font-medium">上升</span>
                              </>
                            )}
                            {period.trends.comparedToPrevious === 'down' && (
                              <>
                                <TrendingDownIcon className="h-4 w-4 text-red-500" />
                                <span className="text-red-600 font-medium">下降</span>
                              </>
                            )}
                            {period.trends.comparedToPrevious === 'stable' && (
                              <>
                                <MinusIcon className="h-4 w-4 text-yellow-500" />
                                <span className="text-yellow-600 font-medium">稳定</span>
                              </>
                            )}
                            {period.trends.comparedToPrevious === 'new' && (
                              <Badge variant="secondary" className="text-xs">首期数据</Badge>
                            )}
                          </div>
                          
                          {period.trends.growthPercentage !== 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">增长率:</span>
                              <span className={`font-medium ${
                                period.trends.growthPercentage > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {period.trends.growthPercentage > 0 ? '+' : ''}{period.trends.growthPercentage}%
                              </span>
                            </div>
                          )}

                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground mb-1">对比说明:</div>
                            <div className="text-xs text-gray-600 mb-2 bg-blue-50 dark:bg-blue-900/20 p-1 rounded">
                              相比上一{viewMode === 'monthly' ? '月' : viewMode === 'weekly' ? '周' : '年'}互动表现
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">关键洞察:</div>
                            <div className="space-y-1">
                              {period.trends.insights.slice(0, 2).map((insight, idx) => (
                                <div key={idx} className="text-xs text-foreground bg-muted/30 px-2 py-1 rounded">
                                  {insight}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 最佳表现 */}
                      <div className="p-2 overflow-hidden">
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground mb-1">📈 建议:</div>
                          <div className="space-y-1 max-h-16 overflow-y-auto">
                            {period.trends.recommendations.slice(0, 2).map((recommendation, idx) => (
                              <div key={idx} className="text-xs text-foreground bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/30 px-2 py-1 rounded text-truncate">
                                • {recommendation.length > 20 ? recommendation.substring(0, 20) + '...' : recommendation}
                              </div>
                            ))}
                          </div>
                          
                          <div className="text-xs text-muted-foreground mb-1">🎯 最佳时间:</div>
                          <div className="text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded">
                            {period.bestPostingTime}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 移动版卡片布局 */}
                    <div className="xl:hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-border/50 rounded-xl p-5 mb-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-5 pb-3 border-b border-border/30">
                        <h3 className="font-bold text-lg text-primary">{period.displayName}</h3>
                        <Badge variant="secondary" className="px-3 py-1 font-medium">{period.totalTweets} 推文</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-5 text-sm">
                        {/* 内容统计 */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <h4 className="font-bold text-blue-700 dark:text-blue-300 text-sm mb-3 flex items-center gap-2">
                            📊 内容统计
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-xs">推文数:</span>
                              <span className="text-xs font-medium">{period.totalTweets}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-xs">平均长度:</span>
                              <span className="text-xs font-medium">{period.content.avgLength} 字符</span>
                            </div>
                          </div>
                        </div>

                        {/* 参与度分析 */}
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <h4 className="font-bold text-green-700 dark:text-green-300 text-sm mb-3 flex items-center gap-2">
                            💬 参与度分析
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-xs">总互动:</span>
                              <span className="text-xs font-medium">{formatNumber(period.engagement.totalEngagement)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground text-xs">互动率:</span>
                              <span className="text-xs font-medium">{period.engagement.engagementRate}%</span>
                            </div>
                          </div>
                        </div>

                        {/* AI内容分类 */}
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                          <h4 className="font-bold text-purple-700 dark:text-purple-300 text-sm mb-3 flex items-center gap-2">
                            🤖 AI内容分类
                          </h4>
                          <div className="space-y-2">
                            {contentClassification ? (
                              Object.entries(contentClassification.summary).slice(0, 3).map(([category, count]) => (
                                <div key={category} className="flex justify-between">
                                  <span className="text-xs">{category}:</span>
                                  <span className="text-xs font-medium text-purple-600">{count as number}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground">🤖 分析中...</div>
                            )}
                          </div>
                        </div>

                        {/* 粉丝增长 */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                          <h4 className="font-bold text-indigo-700 dark:text-indigo-300 text-sm mb-3 flex items-center gap-2">
                            📈 粉丝增长
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-xs">增长数:</span>
                              <span className={`text-xs font-medium ${
                                period.followerGrowth > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {period.followerGrowth > 0 ? '+' : ''}{formatNumber(period.followerGrowth)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 关键词趋势 */}
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                          <h4 className="font-bold text-orange-700 dark:text-orange-300 text-sm mb-3 flex items-center gap-2">
                            🔥 热门关键词
                          </h4>
                          <div className="space-y-2">
                            {keywordTrends ? (
                              keywordTrends.trending_keywords.slice(0, 3).map((keyword: any, i: number) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-xs">{keyword.keyword}:</span>
                                  <span className="text-xs font-medium text-orange-600">{keyword.frequency}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground">🔥 分析中...</div>
                            )}
                          </div>
                        </div>

                        {/* 趋势对比 */}
                        <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg">
                          <h4 className="font-bold text-pink-700 dark:text-pink-300 text-sm mb-3 flex items-center gap-2">
                            📈 趋势对比
                          </h4>
                          <div className="space-y-2">
                            {period.trends.comparedToPrevious === 'up' && (
                              <>
                                <TrendingUpIcon className="h-3 w-3 text-green-500" />
                                <span className="text-xs text-green-600 font-medium">上升</span>
                              </>
                            )}
                            {period.trends.comparedToPrevious === 'down' && (
                              <>
                                <TrendingDownIcon className="h-3 w-3 text-red-500" />
                                <span className="text-xs text-red-600 font-medium">下降</span>
                              </>
                            )}
                            {period.trends.comparedToPrevious === 'stable' && (
                              <>
                                <MinusIcon className="h-3 w-3 text-yellow-500" />
                                <span className="text-xs text-yellow-600 font-medium">稳定</span>
                              </>
                            )}
                            {period.trends.comparedToPrevious === 'new' && (
                              <Badge variant="secondary" className="text-xs">首期数据</Badge>
                            )}
                          </div>
                        </div>
                        
                        {period.engagement.topPerformingTweet && (
                          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-yellow-600 dark:text-yellow-400 font-bold text-sm">🎯 热门推文</span>
                              <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900 border-yellow-300 dark:border-yellow-700">
                                最佳表现
                              </Badge>
                            </div>
                            <div className="font-medium mb-3 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
                              {period.engagement.topPerformingTweet.text}
                            </div>
                            <div className="flex gap-4 text-sm">
                              <div className="flex items-center gap-1 text-red-500">
                                <span>❤️</span>
                                <span className="font-medium">{formatNumber(period.engagement.topPerformingTweet.likes)}</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-500">
                                <span>🔄</span>
                                <span className="font-medium">{formatNumber(period.engagement.topPerformingTweet.retweets)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

        </div>
      </div>
    </main>
  );
}