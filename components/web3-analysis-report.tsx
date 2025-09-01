'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  AlertCircle, 
  Brain, 
  Zap, 
  Hash,
  Globe,
  MessageCircle
} from 'lucide-react';

interface TweetData {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
  };
  [key: string]: any;
}

interface Web3AnalysisReport {
  overview: {
    summary: string;
    key_metrics: string[];
  };
  content_insights: {
    top_themes: string[];
    engagement_drivers: string[];
    content_recommendations: string[];
  };
  community_analysis: {
    audience_behavior: string;
    growth_opportunities: string[];
    engagement_patterns: string;
  };
  strategic_recommendations: {
    immediate_actions: string[];
    long_term_strategy: string[];
    risk_considerations: string[];
  };
  performance_metrics: {
    content_quality_score: number;
    engagement_efficiency: number;
    growth_potential: number;
  };
}

interface Web3AnalysisReportProps {
  tweetData: TweetData[];
  username: string;
}

export default function Web3AnalysisReport({ tweetData, username }: Web3AnalysisReportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<Web3AnalysisReport | null>(null);
  const [selectedModel, setSelectedModel] = useState<'deepseek' | 'openai'>('deepseek');
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    if (!tweetData || tweetData.length === 0) {
      setError('没有可分析的推文数据');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/web3-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweets: tweetData,
          username,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `分析请求失败 (${response.status})`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setAnalysisReport(result.data);
      } else {
        throw new Error(result.error || '分析数据格式错误');
      }
    } catch (error: any) {
      console.error('Web3 Analysis failed:', error);
      setError(error.message || 'Web3分析生成失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMetric = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const totalEngagement = (tweetData || []).reduce((sum, tweet) => 
    sum + (tweet.public_metrics?.like_count || tweet.like_count || 0) + 
    (tweet.public_metrics?.retweet_count || tweet.retweet_count || 0) + 
    (tweet.public_metrics?.reply_count || tweet.reply_count || 0) + 
    (tweet.public_metrics?.quote_count || tweet.quote_count || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Web3运营分析报告
          </CardTitle>
          <CardDescription>
            基于 {(tweetData || []).length.toLocaleString()} 条推文生成专业的Web3运营分析报告
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedModel} onValueChange={(value: 'deepseek' | 'openai') => setSelectedModel(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择AI模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-500" />
                      DeepSeek (推荐)
                    </div>
                  </SelectItem>
                  <SelectItem value="openai">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-green-500" />
                      OpenAI GPT-4
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={generateReport}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  生成分析报告
                </>
              )}
            </Button>
          </div>

          {/* 数据概览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">推文数量</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{(tweetData || []).length.toLocaleString()}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
              <div className="text-green-600 dark:text-green-400 text-sm font-medium">总互动数</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatMetric(totalEngagement)}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
              <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">分析账号</div>
              <div className="text-lg font-bold text-purple-700 dark:text-purple-300">@{username}</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <div className="text-amber-600 dark:text-amber-400 text-sm font-medium">AI模型</div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300 capitalize">{selectedModel}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 分析报告内容 */}
      {analysisReport ? (
        <div className="space-y-6">
          {/* 概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                Web3运营概览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                {analysisReport.overview.summary}
              </p>
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">关键指标</h4>
                <div className="grid gap-2">
                  {analysisReport.overview.key_metrics.map((metric, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{metric}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 内容洞察 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-green-600" />
                内容洞察
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">热门主题</h4>
                <div className="flex flex-wrap gap-2">
                  {analysisReport.content_insights.top_themes.map((theme, index) => (
                    <Badge key={index} variant="secondary" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">互动驱动因素</h4>
                <div className="space-y-2">
                  {analysisReport.content_insights.engagement_drivers.map((driver, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{driver}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">内容建议</h4>
                <div className="space-y-2">
                  {analysisReport.content_insights.content_recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <Target className="w-3 h-3 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 社群分析 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                社群分析
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">受众行为</h4>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {analysisReport.community_analysis.audience_behavior}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">增长机会</h4>
                <div className="space-y-2">
                  {analysisReport.community_analysis.growth_opportunities.map((opportunity, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{opportunity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">互动模式</h4>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {analysisReport.community_analysis.engagement_patterns}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 战略建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-red-600" />
                战略建议
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">立即行动</h4>
                <div className="space-y-2">
                  {analysisReport.strategic_recommendations.immediate_actions.map((action, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900">#{index + 1}</Badge>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">长期策略</h4>
                <div className="space-y-2">
                  {analysisReport.strategic_recommendations.long_term_strategy.map((strategy, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{strategy}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">风险考虑</h4>
                <div className="space-y-2">
                  {analysisReport.strategic_recommendations.risk_considerations.map((risk, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 性能指标 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-600" />
                性能指标
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {Math.round(analysisReport.performance_metrics.content_quality_score * 100)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">内容质量分</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {Math.round(analysisReport.performance_metrics.engagement_efficiency * 100)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">互动效率</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {Math.round(analysisReport.performance_metrics.growth_potential * 100)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">增长潜力</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              暂无Web3分析报告
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              点击上方"生成分析报告"按钮开始专业的Web3运营分析
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}