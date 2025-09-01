'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Brain, 
  Sparkles, 
  AlertCircle,
  Zap,
  Clock,
  Hash
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
  [key: string]: any;
}

interface QAResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    tweet_id: string;
    tweet_text: string;
    relevance_score: number;
  }>;
}

interface QAHistoryItem {
  question: string;
  response: QAResponse;
  timestamp: string;
  model: string;
}

interface AIQuestionAnswerProps {
  tweetData: TweetData[];
  username: string;
}

export default function AIQuestionAnswer({ tweetData, username }: AIQuestionAnswerProps) {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'deepseek' | 'openai'>('deepseek');
  const [qaHistory, setQaHistory] = useState<QAHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const askQuestion = async () => {
    if (!question.trim()) {
      setError('请输入问题');
      return;
    }

    if (!tweetData || tweetData.length === 0) {
      setError('没有可查询的推文数据');
      return;
    }

    setIsAsking(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          tweets: tweetData,
          username,
          model: selectedModel
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `问答请求失败 (${response.status})`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const newQA: QAHistoryItem = {
          question: question.trim(),
          response: result.data,
          timestamp: new Date().toLocaleString('zh-CN'),
          model: selectedModel
        };
        
        setQaHistory(prev => [newQA, ...prev]);
        setQuestion('');
      } else {
        throw new Error(result.error || '问答数据格式错误');
      }
    } catch (error: any) {
      console.error('AI Q&A failed:', error);
      setError(error.message || 'AI问答失败，请稍后重试');
    } finally {
      setIsAsking(false);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    return 'text-red-600 bg-red-100 dark:bg-red-900/20';
  };

  const suggestedQuestions = [
    '这个账号的内容策略如何？',
    '最受欢迎的推文类型是什么？',
    '用户互动最好的时间段是什么时候？',
    '有哪些值得学习的内容创作模式？',
    '社群参与度如何？有什么改进建议吗？'
  ];

  return (
    <div className="space-y-6">
      {/* 问答输入区 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            AI智能问答
          </CardTitle>
          <CardDescription>
            基于 @{username} 的 {(tweetData || []).length.toLocaleString()} 条推文数据进行智能问答
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
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
          </div>

          <Textarea
            placeholder="请输入您的问题，例如：这个账号的内容策略如何？最受欢迎的推文类型是什么？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="resize-none"
          />
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              数据基于 {(tweetData || []).length.toLocaleString()} 条推文
            </div>
            <Button 
              onClick={askQuestion}
              disabled={isAsking || !question.trim()}
              className="flex items-center gap-2"
            >
              {isAsking ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  思考中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  提问
                </>
              )}
            </Button>
          </div>

          {/* 建议问题 */}
          {qaHistory.length === 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">建议问题：</h4>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestedQ, index) => (
                  <button
                    key={index}
                    onClick={() => setQuestion(suggestedQ)}
                    className="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    {suggestedQ}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 问答历史 */}
      <div className="space-y-4">
        {qaHistory.length > 0 ? (
          qaHistory.map((qa, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* 问题 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          您的问题
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {qa.timestamp}
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{qa.question}</p>
                      </div>
                    </div>
                  </div>

                  {/* 回答 */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-green-600 dark:text-green-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          AI回答
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getConfidenceColor(qa.response.confidence)}>
                            置信度: {Math.round(qa.response.confidence * 100)}%
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {qa.model.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                          {qa.response.answer}
                        </p>
                      </div>
                      
                      {/* 参考推文 */}
                      {qa.response.sources && qa.response.sources.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            <Hash className="w-3 h-3" />
                            参考推文 ({qa.response.sources.length}条)
                          </div>
                          <div className="space-y-2">
                            {qa.response.sources.slice(0, 3).map((source, sourceIndex) => (
                              <div key={sourceIndex} className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-2 rounded border-l-2 border-gray-300 dark:border-gray-600">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-mono text-xs text-gray-400">#{source.tweet_id.slice(-8)}</span>
                                  <Badge variant="outline" className="text-xs">
                                    相关度: {Math.round(source.relevance_score * 100)}%
                                  </Badge>
                                </div>
                                <p className="leading-relaxed">
                                  {source.tweet_text.length > 150 ? `${source.tweet_text.substring(0, 150)}...` : source.tweet_text}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MessageCircle className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                暂无问答记录
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                在上方输入问题开始AI智能问答
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}