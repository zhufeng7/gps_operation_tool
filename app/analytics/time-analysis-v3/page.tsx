"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccountSelector } from "@/components/account-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart3Icon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  RefreshCwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TableIcon,
  DownloadIcon,
  HomeIcon,
  ArrowLeftIcon
} from "lucide-react";
import { ClientAuthButton } from "@/components/client-auth-button";
import Web3AnalysisReport from "@/components/web3-analysis-report";
import AIQuestionAnswer from "@/components/ai-question-answer";

// 推文数据类型
interface Tweet {
  id: string;
  text: string;
  created_at: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  view_count: number;  // 新增浏览量字段
  has_media: boolean;
  engagement_score?: number;
}

// 时间段数据类型
interface TimeSegment {
  period: string;
  displayName: string;
  startDate: string;
  endDate: string;
  tweets: Tweet[];
  stats: {
    totalTweets: number;
    avgEngagement: number;
    totalEngagement: number;
    engagementRate: number;
    topTweet: Tweet | null;
  };
  content: {
    aiClassification?: {
      categories: { [key: string]: number };
      insights: string[];
    };
    avgLength: number;
    mediaPercentage: number;
  };
  trends: {
    followerGrowth: number;
    followerGrowthRate: number;
    keywords?: Array<{ keyword: string; frequency: number; engagement: number }>;
    engagement: {
      likes: { trend: 'up' | 'down' | 'stable' | 'new', percentage: number };
      retweets: { trend: 'up' | 'down' | 'stable' | 'new', percentage: number };
      replies: { trend: 'up' | 'down' | 'stable' | 'new', percentage: number };
      views: { trend: 'up' | 'down' | 'stable' | 'new', percentage: number };
    };
  };
  comparison: {
    compared_to_previous: 'up' | 'down' | 'stable' | 'new';
    growth_percentage: number;
    insights: string[];
  };
}

// 用户数据类型
interface UserData {
  username: string;
  name: string;
  profile_image_url: string;
  followers_count: number;
  following_count: number;
  tweet_count: number;
}

export default function TimeAnalysisV3Page() {
  const [mounted, setMounted] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [allTweets, setAllTweets] = useState<Tweet[]>([]);
  const [timeSegments, setTimeSegments] = useState<TimeSegment[]>([]);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedAccount && mounted) {
      loadUserData(selectedAccount);
    }
  }, [selectedAccount, mounted]);

  useEffect(() => {
    if (allTweets.length > 0) {
      generateTimeSegments();
    }
  }, [allTweets, viewMode]);

  const loadUserData = async (username: string) => {
    if (!username) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/twitter/get-user-data?username=${encodeURIComponent(username)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取数据失败');
      }

      if (data.success && data.data) {
        setUserData(data.data.user);
        setAllTweets(data.data.tweets || []);
        
        console.log(`[TimeAnalysisV3] Loaded ${data.data.tweets?.length || 0} tweets for @${username}`);
      }
    } catch (error: any) {
      console.error('[TimeAnalysisV3] Load error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTimeSegments = () => {
    if (!allTweets.length) return;

    const segments: TimeSegment[] = [];
    const sortedTweets = [...allTweets].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const earliestDate = new Date(sortedTweets[0].created_at);
    const latestDate = new Date(sortedTweets[sortedTweets.length - 1].created_at);

    // 获取周一的辅助函数
    const getMondayOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay(); // 0是周日，1是周一，...6是周六
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };

    // 根据视图模式调整起始日期
    let currentDate: Date;
    if (viewMode === 'weekly') {
      // 周视图：从最早推文所在周的周一开始
      currentDate = getMondayOfWeek(earliestDate);
      currentDate.setHours(0, 0, 0, 0);
    } else if (viewMode === 'monthly') {
      // 月视图：从最早推文所在月的月初开始
      currentDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
      currentDate.setHours(0, 0, 0, 0);
    } else {
      currentDate = new Date(earliestDate);
      currentDate.setHours(0, 0, 0, 0);
    }

    let segmentIndex = 0;

    while (currentDate <= latestDate) {
      let endDate: Date;
      let displayName: string;

      switch (viewMode) {
        case 'daily':
          endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() + 1);
          endDate.setHours(0, 0, 0, 0);
          displayName = currentDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          break;
        case 'weekly':
          // 周一到周日
          endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() + 6); // 周日
          endDate.setHours(23, 59, 59, 999);
          displayName = `${currentDate.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric'
          })}-${endDate.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric'
          })}`;
          break;
        case 'monthly':
          // 月初到月末
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          displayName = currentDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short'
          });
          break;
        default:
          endDate = new Date(currentDate);
          endDate.setDate(endDate.getDate() + 7);
          displayName = 'Unknown';
      }

      const segmentTweets = sortedTweets.filter(tweet => {
        const tweetDate = new Date(tweet.created_at);
        return tweetDate >= currentDate && tweetDate <= endDate;
      });

      if (segmentTweets.length > 0) {
        const segment = createTimeSegment(
          `${viewMode}_${segmentIndex}`,
          displayName,
          currentDate.toISOString(),
          endDate.toISOString(),
          segmentTweets,
          segmentIndex > 0 ? segments[segments.length - 1] : null
        );
        segments.push(segment);
      }

      // 递增到下一个时间段
      if (viewMode === 'weekly') {
        // 跳到下周一
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (viewMode === 'monthly') {
        // 跳到下个月的月初
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        currentDate.setHours(0, 0, 0, 0);
      } else {
        // 日视图：跳到下一天
        currentDate.setDate(currentDate.getDate() + 1);
      }
      segmentIndex++;
    }

    // 按时间倒序排列，使最近的时间在左边
    segments.reverse();

    // 重新计算对比数据（因为顺序改变了）
    for (let i = 0; i < segments.length; i++) {
      const currentSegment = segments[i];
      const previousSegment = i < segments.length - 1 ? segments[i + 1] : null;

      if (previousSegment) {
        const currentAvgEng = currentSegment.stats.avgEngagement;
        const prevAvgEng = previousSegment.stats.avgEngagement;
        const growthPct = prevAvgEng > 0 ? ((currentAvgEng - prevAvgEng) / prevAvgEng) * 100 : 0;

        let comparedStatus: 'up' | 'down' | 'stable' = 'stable';
        if (growthPct > 5) comparedStatus = 'up';
        else if (growthPct < -5) comparedStatus = 'down';

        currentSegment.comparison = {
          compared_to_previous: comparedStatus,
          growth_percentage: Math.round(growthPct * 10) / 10,
          insights: generateInsights(currentSegment.tweets, previousSegment.tweets)
        };
      }
    }

    setTimeSegments(segments);
    
    // 自动执行AI分析
    if (segments.length > 0) {
      performAIAnalysis(segments);
    }
  };

  const createTimeSegment = (
    period: string,
    displayName: string,
    startDate: string,
    endDate: string,
    tweets: Tweet[],
    previousSegment: TimeSegment | null
  ): TimeSegment => {
    const totalEngagement = tweets.reduce((sum, tweet) => 
      sum + (tweet.like_count || 0) + (tweet.retweet_count || 0) + (tweet.reply_count || 0), 0
    );
    
    const avgEngagement = tweets.length > 0 ? totalEngagement / tweets.length : 0;
    const topTweet = tweets.reduce((prev, current) => {
      const prevEng = (prev.like_count || 0) + (prev.retweet_count || 0) + (prev.reply_count || 0);
      const currEng = (current.like_count || 0) + (current.retweet_count || 0) + (current.reply_count || 0);
      return currEng > prevEng ? current : prev;
    }, tweets[0]);

    const avgLength = tweets.length > 0 
      ? tweets.reduce((sum, t) => sum + (t.text?.length || 0), 0) / tweets.length 
      : 0;
    
    const mediaCount = tweets.filter(t => t.has_media).length;
    const mediaPercentage = tweets.length > 0 ? (mediaCount / tweets.length) * 100 : 0;

    // 计算与上一时段的对比
    let comparison: TimeSegment['comparison'];
    if (!previousSegment) {
      comparison = {
        compared_to_previous: 'new',
        growth_percentage: 0,
        insights: ['首个时间段，无对比数据']
      };
    } else {
      const prevAvgEng = previousSegment.stats.avgEngagement;
      const growthPct = prevAvgEng > 0 ? ((avgEngagement - prevAvgEng) / prevAvgEng) * 100 : 0;
      
      let comparedStatus: 'up' | 'down' | 'stable' = 'stable';
      if (growthPct > 5) comparedStatus = 'up';
      else if (growthPct < -5) comparedStatus = 'down';

      comparison = {
        compared_to_previous: comparedStatus,
        growth_percentage: Math.round(growthPct * 10) / 10,
        insights: generateInsights(tweets, previousSegment.tweets)
      };
    }

    // 估算粉丝增长
    const followerGrowth = userData ? estimateFollowerGrowth(tweets, userData) : 0;
    const followerGrowthRate = userData && userData.followers_count > 0
      ? (followerGrowth / userData.followers_count) * 100
      : 0;

    // 计算各种参与度指标的趋势
    const calculateEngagementTrends = () => {
      if (!previousSegment) {
        return {
          likes: { trend: 'new' as const, percentage: 0 },
          retweets: { trend: 'new' as const, percentage: 0 },
          replies: { trend: 'new' as const, percentage: 0 },
          views: { trend: 'new' as const, percentage: 0 }
        };
      }

      const currentLikes = tweets.reduce((sum, t) => sum + (t.like_count || 0), 0);
      const currentRetweets = tweets.reduce((sum, t) => sum + (t.retweet_count || 0), 0);
      const currentReplies = tweets.reduce((sum, t) => sum + (t.reply_count || 0), 0);
      const currentViews = tweets.reduce((sum, t) => sum + (t.view_count || 0), 0);

      const prevLikes = previousSegment.tweets.reduce((sum, t) => sum + (t.like_count || 0), 0);
      const prevRetweets = previousSegment.tweets.reduce((sum, t) => sum + (t.retweet_count || 0), 0);
      const prevReplies = previousSegment.tweets.reduce((sum, t) => sum + (t.reply_count || 0), 0);
      const prevViews = previousSegment.tweets.reduce((sum, t) => sum + (t.view_count || 0), 0);

      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return { trend: 'new' as const, percentage: 0 };
        const percentage = Math.round(((current - previous) / previous) * 100 * 10) / 10;
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (percentage > 5) trend = 'up';
        else if (percentage < -5) trend = 'down';
        return { trend, percentage };
      };

      return {
        likes: calculateTrend(currentLikes, prevLikes),
        retweets: calculateTrend(currentRetweets, prevRetweets),
        replies: calculateTrend(currentReplies, prevReplies),
        views: calculateTrend(currentViews, prevViews)
      };
    };

    return {
      period,
      displayName,
      startDate,
      endDate,
      tweets,
      stats: {
        totalTweets: tweets.length,
        avgEngagement: Math.round(avgEngagement),
        totalEngagement,
        engagementRate: userData ? calculateEngagementRate(totalEngagement, userData.followers_count) : 0,
        topTweet: topTweet || null
      },
      content: {
        avgLength: Math.round(avgLength),
        mediaPercentage: Math.round(mediaPercentage * 10) / 10
      },
      trends: {
        followerGrowth: Math.round(followerGrowth),
        followerGrowthRate: Math.round(followerGrowthRate * 10) / 10,
        engagement: calculateEngagementTrends()
      },
      comparison
    };
  };

  const estimateFollowerGrowth = (tweets: Tweet[], user: UserData): number => {
    const totalEngagement = tweets.reduce((sum, tweet) => 
      sum + (tweet.like_count || 0) + (tweet.retweet_count || 0) + (tweet.reply_count || 0), 0
    );
    
    const avgEngagementPerTweet = tweets.length > 0 ? totalEngagement / tweets.length : 0;
    const engagementRate = user.followers_count > 0 ? avgEngagementPerTweet / user.followers_count : 0;
    
    // 简化的增长估算公式
    const estimatedGrowth = Math.round(tweets.length * engagementRate * 50);
    
    // 限制在合理范围内
    const maxGrowth = Math.round(user.followers_count * 0.05); // 最多5%增长
    const minGrowth = Math.round(-user.followers_count * 0.02); // 最多2%下降
    
    return Math.max(minGrowth, Math.min(estimatedGrowth, maxGrowth));
  };

  const calculateEngagementRate = (totalEngagement: number, followers: number): number => {
    if (followers === 0) return 0;
    return Math.round((totalEngagement / followers) * 100 * 10) / 10;
  };

  const generateInsights = (currentTweets: Tweet[], previousTweets: Tweet[]): string[] => {
    const insights: string[] = [];
    
    const currentAvg = currentTweets.length > 0 
      ? currentTweets.reduce((sum, t) => sum + ((t.like_count || 0) + (t.retweet_count || 0) + (t.reply_count || 0)), 0) / currentTweets.length 
      : 0;
    
    const previousAvg = previousTweets.length > 0 
      ? previousTweets.reduce((sum, t) => sum + ((t.like_count || 0) + (t.retweet_count || 0) + (t.reply_count || 0)), 0) / previousTweets.length 
      : 0;
    
    if (currentAvg > previousAvg * 1.1) {
      insights.push('互动表现显著提升');
    } else if (currentAvg < previousAvg * 0.9) {
      insights.push('互动表现有所下降');
    } else {
      insights.push('互动表现保持稳定');
    }
    
    const currentMediaRate = currentTweets.length > 0 
      ? (currentTweets.filter(t => t.has_media).length / currentTweets.length) * 100 
      : 0;
    
    const previousMediaRate = previousTweets.length > 0 
      ? (previousTweets.filter(t => t.has_media).length / previousTweets.length) * 100 
      : 0;
    
    if (currentMediaRate > previousMediaRate + 10) {
      insights.push('媒体内容比例增加');
    } else if (currentMediaRate < previousMediaRate - 10) {
      insights.push('媒体内容比例减少');
    }
    
    return insights;
  };

  const performAIAnalysis = async (segments: TimeSegment[]) => {
    setIsAnalyzing(true);
    setAnalysisProgress('🚀 开始高速AI分析...');

    try {
      // 过滤有效的时间段
      const validSegments = segments.filter(segment => segment.tweets.length > 0);
      
      if (validSegments.length === 0) {
        setAnalysisProgress('⚠️ 没有有效数据进行分析');
        return;
      }

      setAnalysisProgress(`🔍 并行分析 ${validSegments.length} 个时间段...`);

      // 并行处理所有时间段的AI分析
      const analysisPromises = validSegments.map(async (segment, index) => {
        try {
          // 只调用内容分类 API（已包含关键词分析）
          const classificationResponse = await fetch('/api/ai/content-classification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              tweets: segment.tweets,
              username: userData?.username 
            })
          });

          if (classificationResponse.ok) {
            const classificationData = await classificationResponse.json();
            if (classificationData.success) {
              // 更新分段数据
              segment.content.aiClassification = {
                categories: classificationData.data.summary,
                insights: classificationData.data.insights || []
              };
              
              // 使用合并后的关键词数据
              if (classificationData.data.trending_keywords) {
                segment.trends.keywords = classificationData.data.trending_keywords.slice(0, 5);
              }
              
              console.log(`✅ 时段 ${segment.displayName} 分析完成`);
              return { success: true, segment: segment.displayName };
            }
          }
          
          console.warn(`⚠️ 时段 ${segment.displayName} 分析部分失败`);
          return { success: false, segment: segment.displayName, error: 'API response not ok' };
          
        } catch (error) {
          console.error(`❌ 时段 ${segment.displayName} 分析失败:`, error);
          return { success: false, segment: segment.displayName, error: error.message };
        }
      });

      // 等待所有并行任务完成
      const results = await Promise.allSettled(analysisPromises);
      
      // 统计结果
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      // 触发重新渲染
      setTimeSegments([...segments]);
      
      if (failed === 0) {
        setAnalysisProgress(`✅ AI分析全部完成！分析了 ${successful} 个时间段`);
      } else {
        setAnalysisProgress(`⚠️ AI分析完成：成功 ${successful}个，失败 ${failed}个`);
      }
      
      setTimeout(() => {
        setAnalysisProgress('');
      }, 4000);
      
    } catch (error: any) {
      console.error('AI analysis error:', error);
      setAnalysisProgress(`❌ AI分析失败: ${error.message}`);
      
      setTimeout(() => {
        setAnalysisProgress('');
      }, 8000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const scrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 300));
  };

  const scrollRight = () => {
    setScrollPosition(scrollPosition + 300);
  };

  const exportToJSON = () => {
    if (!timeSegments.length || !userData) return;

    const exportData = {
      export_info: {
        username: userData.username,
        export_time: new Date().toISOString(),
        analysis_mode: viewMode,
        total_segments: timeSegments.length,
        total_tweets_analyzed: allTweets.length
      },
      user_data: {
        username: userData.username,
        name: userData.name,
        followers_count: userData.followers_count,
        following_count: userData.following_count,
        tweet_count: userData.tweet_count
      },
      time_segments: timeSegments.map(segment => ({
        period: segment.period,
        display_name: segment.displayName,
        start_date: segment.startDate,
        end_date: segment.endDate,
        stats: {
          total_tweets: segment.stats.totalTweets,
          avg_engagement: segment.stats.avgEngagement,
          total_engagement: segment.stats.totalEngagement,
          engagement_rate: segment.stats.engagementRate,
          top_tweet: segment.stats.topTweet
        },
        content: {
          ai_classification: segment.content.aiClassification,
          avg_length: segment.content.avgLength,
          media_percentage: segment.content.mediaPercentage
        },
        trends: {
          follower_growth: segment.trends.followerGrowth,
          follower_growth_rate: segment.trends.followerGrowthRate,
          keywords: segment.trends.keywords
        },
        comparison: segment.comparison,
        tweets: segment.tweets.map(tweet => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          like_count: tweet.like_count,
          retweet_count: tweet.retweet_count,
          reply_count: tweet.reply_count,
          quote_count: tweet.quote_count,
          view_count: tweet.view_count,
          has_media: tweet.has_media
        }))
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twitter_analysis_${userData.username}_${viewMode}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!timeSegments.length || !userData) return;

    const csvData = [
      // CSV Header
      [
        '时间周期',
        '开始日期', 
        '结束日期',
        '推文数量',
        '平均互动',
        '总互动',
        '互动率(%)',
        '媒体占比(%)',
        '平均长度',
        '点赞数',
        '转发数',
        '回复数',
        '浏览量',
        '粉丝增长',
        '增长率(%)',
        '趋势对比',
        '增长百分比(%)',
        'AI分类-第一类',
        'AI分类-第二类',
        'AI分类-第三类',
        '热门关键词',
        '最佳推文文本',
        '最佳推文点赞',
        '最佳推文转发'
      ],
      // CSV Rows
      ...timeSegments.map(segment => [
        segment.displayName,
        new Date(segment.startDate).toLocaleDateString('zh-CN'),
        new Date(segment.endDate).toLocaleDateString('zh-CN'),
        segment.stats.totalTweets,
        segment.stats.avgEngagement,
        segment.stats.totalEngagement,
        segment.stats.engagementRate,
        Math.round(segment.content.mediaPercentage * 10) / 10,
        segment.content.avgLength,
        segment.tweets.reduce((sum, t) => sum + (t.like_count || 0), 0),
        segment.tweets.reduce((sum, t) => sum + (t.retweet_count || 0), 0),
        segment.tweets.reduce((sum, t) => sum + (t.reply_count || 0), 0),
        segment.tweets.reduce((sum, t) => sum + (t.view_count || 0), 0),
        segment.trends.followerGrowth,
        segment.trends.followerGrowthRate,
        segment.comparison.compared_to_previous === 'up' ? '上升' : 
        segment.comparison.compared_to_previous === 'down' ? '下降' :
        segment.comparison.compared_to_previous === 'stable' ? '稳定' : '首期',
        segment.comparison.growth_percentage,
        segment.content.aiClassification ? 
          Object.entries(segment.content.aiClassification.categories)[0]?.[0] + ':' + Object.entries(segment.content.aiClassification.categories)[0]?.[1] : '',
        segment.content.aiClassification ? 
          Object.entries(segment.content.aiClassification.categories)[1]?.[0] + ':' + Object.entries(segment.content.aiClassification.categories)[1]?.[1] : '',
        segment.content.aiClassification ? 
          Object.entries(segment.content.aiClassification.categories)[2]?.[0] + ':' + Object.entries(segment.content.aiClassification.categories)[2]?.[1] : '',
        segment.trends.keywords?.slice(0, 3).map(kw => `${kw.keyword}(${kw.frequency})`).join(', ') || '',
        segment.stats.topTweet?.text?.slice(0, 100) || '',
        segment.stats.topTweet?.like_count || 0,
        segment.stats.topTweet?.retweet_count || 0
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(field => 
        typeof field === 'string' && field.includes(',') 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(',')
    ).join('\n');

    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twitter_analysis_${userData.username}_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToXLSX = async () => {
    if (!timeSegments.length || !userData) return;

    try {
      // 客户端动态加载XLSX库
      if (typeof window === 'undefined') {
        alert('请在浏览器中使用此功能');
        return;
      }
      
      // 动态创建script标签加载XLSX库
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js';
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      // 获取XLSX对象
      const XLSX = (window as any).XLSX;
      
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      
      // 准备数据
      const wsData = [
        // 表头
        [
          '时间周期',
          '开始日期',
          '结束日期',
          '推文数量',
          '平均互动',
          '总互动',
          '互动率(%)',
          '媒体占比(%)',
          '平均长度',
          '点赞数',
          '点赞环比(%)',
          '转发数',
          '转发环比(%)',
          '回复数',
          '回复环比(%)',
          '浏览量',
          '浏览环比(%)',
          '粉丝增长',
          '增长率(%)',
          '趋势对比',
          '增长百分比(%)',
          'AI分类统计',
          '热门关键词Top3',
          '最佳推文文本',
          '最佳推文点赞',
          '最佳推文转发',
          '洞察建议'
        ],
        // 数据行
        ...timeSegments.map(segment => [
          segment.displayName,
          new Date(segment.startDate).toLocaleDateString('zh-CN'),
          new Date(segment.endDate).toLocaleDateString('zh-CN'),
          segment.stats.totalTweets,
          segment.stats.avgEngagement,
          segment.stats.totalEngagement,
          segment.stats.engagementRate,
          Math.round(segment.content.mediaPercentage * 10) / 10,
          segment.content.avgLength,
          segment.tweets.reduce((sum, t) => sum + (t.like_count || 0), 0),
          segment.trends.engagement.likes.trend === 'new' ? '首期' : segment.trends.engagement.likes.percentage,
          segment.tweets.reduce((sum, t) => sum + (t.retweet_count || 0), 0),
          segment.trends.engagement.retweets.trend === 'new' ? '首期' : segment.trends.engagement.retweets.percentage,
          segment.tweets.reduce((sum, t) => sum + (t.reply_count || 0), 0),
          segment.trends.engagement.replies.trend === 'new' ? '首期' : segment.trends.engagement.replies.percentage,
          segment.tweets.reduce((sum, t) => sum + (t.view_count || 0), 0),
          segment.trends.engagement.views.trend === 'new' ? '首期' : segment.trends.engagement.views.percentage,
          segment.trends.followerGrowth,
          segment.trends.followerGrowthRate,
          segment.comparison.compared_to_previous === 'up' ? '上升' :
          segment.comparison.compared_to_previous === 'down' ? '下降' :
          segment.comparison.compared_to_previous === 'stable' ? '稳定' : '首期',
          segment.comparison.growth_percentage,
          segment.content.aiClassification ?
            Object.entries(segment.content.aiClassification.categories)
              .slice(0, 3)
              .map(([cat, count]) => `${cat}:${count}`)
              .join('; ') : '',
          segment.trends.keywords?.slice(0, 3).map(kw => `${kw.keyword}(${kw.frequency})`).join('; ') || '',
          segment.stats.topTweet?.text?.slice(0, 150) || '',
          segment.stats.topTweet?.like_count || 0,
          segment.stats.topTweet?.retweet_count || 0,
          segment.comparison.insights.slice(0, 2).join('; ')
        ])
      ];

      // 创建工作表
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // 添加到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '时间分析数据');
      
      // 第二个工作表：推文原始数据
      if (allTweets.length > 0) {
        const tweetData = [
          ['推文ID', '推文文本', '发布时间', '点赞', '转发', '回复', '引用', '浏览量', '是否含媒体'],
          ...allTweets.map(tweet => [
            tweet.id,
            tweet.text,
            new Date(tweet.created_at).toLocaleString('zh-CN'),
            tweet.like_count || 0,
            tweet.retweet_count || 0,
            tweet.reply_count || 0,
            tweet.quote_count || 0,
            tweet.view_count || 0,
            tweet.has_media ? '是' : '否'
          ])
        ];

        const tweetWs = XLSX.utils.aoa_to_sheet(tweetData);
        XLSX.utils.book_append_sheet(wb, tweetWs, '推文原始数据');
      }

      // 第三个工作表：按照特定格式组织（时间在行上，垂直展示）
      if (timeSegments.length > 0) {
        const formattedData: any[][] = [];

        // 表头行（根据视图模式显示不同的环比类型）
        const periodType = viewMode === 'weekly' ? '周环比' : viewMode === 'monthly' ? '月环比' : '日环比';
        formattedData.push(['周期', '数据统计', periodType, '备注']);

        // 为每个时间周期创建多行数据
        timeSegments.forEach((seg, index) => {
          // 格式化环比数据的辅助函数
          const formatTrend = (trendData: { trend: 'up' | 'down' | 'stable' | 'new', percentage: number }) => {
            if (trendData.trend === 'new') {
              return '首期';
            }
            const trend = trendData.trend === 'up' ? '↑' :
                         trendData.trend === 'down' ? '↓' : '→';
            return `${trend} ${trendData.percentage}%`;
          };

          // 计算推文数量的环比（基于真实推文数量，不是平均互动）
          let tweetCountComparison = '';
          // timeSegments是倒序的，所以前一个时段是index+1
          const previousSeg = index < timeSegments.length - 1 ? timeSegments[index + 1] : null;

          if (!previousSeg) {
            tweetCountComparison = '首期';
          } else {
            const currentCount = seg.stats.totalTweets;
            const previousCount = previousSeg.stats.totalTweets;

            if (previousCount === 0) {
              tweetCountComparison = currentCount > 0 ? '↑ 100%' : '首期';
            } else {
              const growthPct = ((currentCount - previousCount) / previousCount) * 100;
              const roundedPct = Math.round(growthPct * 10) / 10;

              let trend = '→';
              if (growthPct > 5) trend = '↑';
              else if (growthPct < -5) trend = '↓';

              tweetCountComparison = `${trend} ${roundedPct}%`;
            }
          }

          // 获取内容类型
          let contentType = 'AI分析中...';
          if (seg.content.aiClassification) {
            contentType = Object.entries(seg.content.aiClassification.categories)
              .slice(0, 3)
              .map(([cat, count]) => `${cat}:${count}`)
              .join('; ');
          }

          // 获取最佳Post
          let bestPost = '暂无';
          if (seg.stats.topTweet) {
            bestPost = `${seg.stats.topTweet.text.slice(0, 50)}... (❤️${seg.stats.topTweet.like_count} 🔄${seg.stats.topTweet.retweet_count})`;
          }

          // 第一行：时间周期 + 推文数量 + 周环比（使用真实的推文数量环比）
          formattedData.push([
            seg.displayName,
            `推文数量: ${seg.stats.totalTweets}`,
            tweetCountComparison,
            ''
          ]);

          // 后续行：各项数据指标及其对应的环比
          formattedData.push([
            '',
            `❤️ 点赞: ${seg.tweets.reduce((sum, t) => sum + (t.like_count || 0), 0)}`,
            formatTrend(seg.trends.engagement.likes),
            ''
          ]);

          formattedData.push([
            '',
            `🔄 转发: ${seg.tweets.reduce((sum, t) => sum + (t.retweet_count || 0), 0)}`,
            formatTrend(seg.trends.engagement.retweets),
            ''
          ]);

          formattedData.push([
            '',
            `💬 回复: ${seg.tweets.reduce((sum, t) => sum + (t.reply_count || 0), 0)}`,
            formatTrend(seg.trends.engagement.replies),
            ''
          ]);

          formattedData.push([
            '',
            `👁️ 浏览: ${seg.tweets.reduce((sum, t) => sum + (t.view_count || 0), 0)}`,
            formatTrend(seg.trends.engagement.views),
            ''
          ]);

          formattedData.push([
            '',
            `内容类型: ${contentType}`,
            '',
            ''
          ]);

          formattedData.push([
            '',
            `最佳Post: ${bestPost}`,
            '',
            ''
          ]);
        });

        const formattedWs = XLSX.utils.aoa_to_sheet(formattedData);
        XLSX.utils.book_append_sheet(wb, formattedWs, '运营数据汇总');
      }

      // 导出文件
      const fileName = `twitter_analysis_${userData.username}_${viewMode}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      // 清理script标签
      document.head.removeChild(script);
      
    } catch (error) {
      console.error('XLSX导出失败:', error);
      // 降级到CSV导出
      alert('暂时无法加载XLSX库，使用CSV格式导出');
      exportToCSV();
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <HomeIcon className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary">详细时间分析表格</h1>
              <p className="text-muted-foreground mt-1">横向展示各个时间周期的详细运营数据和AI分析结果</p>
            </div>
          </div>
          <ClientAuthButton />
        </div>

        {/* Account Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3Icon className="h-5 w-5" />
              选择分析账号
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccountSelector
              selectedAccount={selectedAccount}
              onAccountSelect={setSelectedAccount}
            />
            {selectedAccount && (
              <div className="mt-4">
                <button 
                  onClick={() => loadUserData(selectedAccount)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  刷新数据
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Window Selection */}
        {userData && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={userData.profile_image_url} 
                    alt={userData.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <h2 className="text-xl font-semibold">{userData.name}</h2>
                    <p className="text-muted-foreground">@{userData.username}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(userData.followers_count)} 关注者 · {formatNumber(allTweets.length)} 推文已收集
                    </p>
                  </div>
                </div>

                <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                  <TabsList>
                    <TabsTrigger value="daily">日分析</TabsTrigger>
                    <TabsTrigger value="weekly">周分析</TabsTrigger>
                    <TabsTrigger value="monthly">月分析</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Progress */}
        {(isLoading || isAnalyzing || analysisProgress) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCwIcon className={`h-4 w-4 ${(isLoading || isAnalyzing) ? 'animate-spin' : ''}`} />
                <span className="text-sm">
                  {isLoading && '正在加载数据...'}
                  {isAnalyzing && '🤖 AI自动分析中...'}
                  {analysisProgress && analysisProgress}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Horizontal Time Analysis Table */}
        {timeSegments.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  时间分析表格 ({viewMode === 'daily' ? '日' : viewMode === 'weekly' ? '周' : '月'}度视图)
                </CardTitle>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 mr-4">
                    <button 
                      onClick={exportToJSON}
                      className="px-3 py-2 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg transition-colors flex items-center gap-1"
                      disabled={!timeSegments.length}
                    >
                      <DownloadIcon className="h-3 w-3" />
                      JSON
                    </button>
                    <button 
                      onClick={exportToCSV}
                      className="px-3 py-2 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg transition-colors flex items-center gap-1"
                      disabled={!timeSegments.length}
                    >
                      <DownloadIcon className="h-3 w-3" />
                      CSV
                    </button>
                    <button 
                      onClick={exportToXLSX}
                      className="px-3 py-2 text-xs bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg transition-colors flex items-center gap-1"
                      disabled={!timeSegments.length}
                    >
                      <DownloadIcon className="h-3 w-3" />
                      XLSX
                    </button>
                  </div>
                  
                  <button 
                    onClick={scrollLeft}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    disabled={scrollPosition <= 0}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={scrollRight}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <div 
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${scrollPosition}px)` }}
                >
                  {/* Row Headers */}
                  <div className="flex-shrink-0 w-40 bg-gradient-to-r from-primary/5 to-primary/10 border-r">
                    <div className="h-20 flex items-center justify-center border-b font-semibold text-sm bg-primary/10">
                      🕒 时间周期
                    </div>
                    <div className="h-20 flex items-center px-3 border-b text-xs font-medium">📊 内容统计</div>
                    <div className="h-28 flex items-center px-3 border-b text-xs font-medium">💬 参与度分析</div>
                    <div className="h-28 flex items-center px-3 border-b text-xs font-medium">📈 参与度趋势对比</div>
                    <div className="h-24 flex items-center px-3 border-b text-xs font-medium">📝 内容分析</div>
                    <div className="h-28 flex items-center px-3 text-xs font-medium">❤️ 最佳表现</div>
                  </div>

                  {/* Time Columns */}
                  {timeSegments.map((segment, index) => (
                    <div key={segment.period} className="flex-shrink-0 w-48 border-r">
                      {/* Column Header */}
                      <div className="h-20 flex flex-col items-center justify-center border-b bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                        <div className="font-semibold text-sm text-primary">{segment.displayName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {segment.stats.totalTweets} 推文
                        </div>
                      </div>

                      {/* 内容统计行 */}
                      <div className="h-20 border-b px-2 py-2 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">总推文:</span>
                          <span className="font-medium text-blue-600">{segment.stats.totalTweets}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">含媒体:</span>
                          <span className="font-medium">{Math.round(segment.content.mediaPercentage)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">平均长度:</span>
                          <span className="font-medium">{segment.content.avgLength}字符</span>
                        </div>
                      </div>

                      {/* 参与度分析行 */}
                      <div className="h-28 border-b px-2 py-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">❤️ 点赞:</span>
                          <span className="font-medium text-red-500">{formatNumber(segment.tweets.reduce((sum, t) => sum + (t.like_count || 0), 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">🔄 转发:</span>
                          <span className="font-medium text-green-500">{formatNumber(segment.tweets.reduce((sum, t) => sum + (t.retweet_count || 0), 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">💬 回复:</span>
                          <span className="font-medium text-blue-500">{formatNumber(segment.tweets.reduce((sum, t) => sum + (t.reply_count || 0), 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">👁️ 浏览:</span>
                          <span className="font-medium text-purple-500">{formatNumber(segment.tweets.reduce((sum, t) => sum + (t.view_count || 0), 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">平均互动:</span>
                          <span className="font-medium text-purple-600">{formatNumber(segment.stats.avgEngagement)}</span>
                        </div>
                      </div>

                      {/* 参与度趋势对比行 */}
                      <div className="h-28 border-b px-2 py-2 text-xs">
                        <div className="space-y-1.5">
                          {/* 点赞趋势 */}
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">❤️ 点赞:</span>
                            <div className="flex items-center gap-1">
                              {segment.trends.engagement.likes.trend === 'up' && <TrendingUpIcon className="h-3 w-3 text-green-500" />}
                              {segment.trends.engagement.likes.trend === 'down' && <TrendingDownIcon className="h-3 w-3 text-red-500" />}
                              {segment.trends.engagement.likes.trend === 'stable' && <MinusIcon className="h-3 w-3 text-yellow-500" />}
                              <span className={`font-medium text-xs ${
                                segment.trends.engagement.likes.percentage > 0 ? 'text-green-600' :
                                segment.trends.engagement.likes.percentage < 0 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {segment.trends.engagement.likes.trend === 'new' ? '首期' :
                                  `${segment.trends.engagement.likes.percentage > 0 ? '+' : ''}${segment.trends.engagement.likes.percentage}%`}
                              </span>
                            </div>
                          </div>

                          {/* 转发趋势 */}
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">🔄 转发:</span>
                            <div className="flex items-center gap-1">
                              {segment.trends.engagement.retweets.trend === 'up' && <TrendingUpIcon className="h-3 w-3 text-green-500" />}
                              {segment.trends.engagement.retweets.trend === 'down' && <TrendingDownIcon className="h-3 w-3 text-red-500" />}
                              {segment.trends.engagement.retweets.trend === 'stable' && <MinusIcon className="h-3 w-3 text-yellow-500" />}
                              <span className={`font-medium text-xs ${
                                segment.trends.engagement.retweets.percentage > 0 ? 'text-green-600' :
                                segment.trends.engagement.retweets.percentage < 0 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {segment.trends.engagement.retweets.trend === 'new' ? '首期' :
                                  `${segment.trends.engagement.retweets.percentage > 0 ? '+' : ''}${segment.trends.engagement.retweets.percentage}%`}
                              </span>
                            </div>
                          </div>

                          {/* 回复趋势 */}
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">💬 回复:</span>
                            <div className="flex items-center gap-1">
                              {segment.trends.engagement.replies.trend === 'up' && <TrendingUpIcon className="h-3 w-3 text-green-500" />}
                              {segment.trends.engagement.replies.trend === 'down' && <TrendingDownIcon className="h-3 w-3 text-red-500" />}
                              {segment.trends.engagement.replies.trend === 'stable' && <MinusIcon className="h-3 w-3 text-yellow-500" />}
                              <span className={`font-medium text-xs ${
                                segment.trends.engagement.replies.percentage > 0 ? 'text-green-600' :
                                segment.trends.engagement.replies.percentage < 0 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {segment.trends.engagement.replies.trend === 'new' ? '首期' :
                                  `${segment.trends.engagement.replies.percentage > 0 ? '+' : ''}${segment.trends.engagement.replies.percentage}%`}
                              </span>
                            </div>
                          </div>

                          {/* 浏览量趋势 */}
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">👁️ 浏览:</span>
                            <div className="flex items-center gap-1">
                              {segment.trends.engagement.views.trend === 'up' && <TrendingUpIcon className="h-3 w-3 text-green-500" />}
                              {segment.trends.engagement.views.trend === 'down' && <TrendingDownIcon className="h-3 w-3 text-red-500" />}
                              {segment.trends.engagement.views.trend === 'stable' && <MinusIcon className="h-3 w-3 text-yellow-500" />}
                              <span className={`font-medium text-xs ${
                                segment.trends.engagement.views.percentage > 0 ? 'text-green-600' :
                                segment.trends.engagement.views.percentage < 0 ? 'text-red-600' : 'text-yellow-600'
                              }`}>
                                {segment.trends.engagement.views.trend === 'new' ? '首期' :
                                  `${segment.trends.engagement.views.percentage > 0 ? '+' : ''}${segment.trends.engagement.views.percentage}%`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 内容分析行 */}
                      <div className="h-24 border-b px-2 py-2 text-xs">
                        {segment.content.aiClassification ? (
                          <div className="space-y-1">
                            <div className="text-purple-600 font-semibold mb-1">🤖 AI分类:</div>
                            {Object.entries(segment.content.aiClassification.categories).slice(0, 3).map(([cat, count]) => (
                              <div key={cat} className="flex justify-between">
                                <span className="text-muted-foreground">{cat}:</span>
                                <span className="font-medium text-purple-600">{count as number}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-4">
                            <div>🤖 AI分析中...</div>
                            <div>请稍候</div>
                          </div>
                        )}
                      </div>

                      {/* 最佳表现行 */}
                      <div className="h-28 px-2 py-2 text-xs">
                        <div className="space-y-2">
                          <div className="text-pink-600 font-semibold mb-1">🎯 热门推文:</div>
                          {segment.stats.topTweet ? (
                            <>
                              <div className="font-medium mb-2 line-clamp-2 text-gray-700 dark:text-gray-300">
                                {segment.stats.topTweet.text.slice(0, 50)}...
                              </div>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                <span>❤️ {formatNumber(segment.stats.topTweet.like_count)}</span>
                                <span>🔄 {formatNumber(segment.stats.topTweet.retweet_count)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-center text-muted-foreground py-4">
                              暂无热门推文
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

        {/* Additional Analysis Components */}
        {userData && allTweets.length > 0 && (
          <>
            <Web3AnalysisReport 
              tweetData={allTweets}
              username={userData.username}
            />
            <AIQuestionAnswer 
              tweetData={allTweets}
              username={userData.username}
            />
          </>
        )}
      </div>
    </div>
  );
}