"use client";

import { useState, useEffect } from "react";
import { AccountSelector } from "@/components/account-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  WandIcon,
  CopyIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  MessageSquareIcon,
  HeartIcon,
  RepeatIcon,
  // EyeIcon,
  SearchIcon,
  SparklesIcon,
  BrainIcon,
  TargetIcon,
  ZapIcon,
  CheckIcon
} from "lucide-react";
import Link from "next/link";
import { ClientAuthButton } from "@/components/client-auth-button";

interface TweetStyle {
  tone: string;
  keywords: string[];
  avgLength: number;
  commonPatterns: string[];
  emojiUsage: boolean;
  hashtagStyle: string;
}

interface RewrittenTweet {
  original: string;
  rewritten: string;
  tone: string;
  confidence: number;
  improvements: string[];
}

interface TopTweet {
  id: string;
  text: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
  engagement_score: number;
  created_at: string;
  tweet_url: string;
}

export default function TweetRewriterPage() {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [customTweet, setCustomTweet] = useState("");
  const [selectedTone, setSelectedTone] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tweetStyle, setTweetStyle] = useState<TweetStyle | null>(null);
  const [topTweets, setTopTweets] = useState<TopTweet[]>([]);
  const [rewrittenTweets, setRewrittenTweets] = useState<RewrittenTweet[]>([]);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 当选择账号时自动加载数据
  useEffect(() => {
    if (selectedAccount && !tweetStyle) {
      loadUserDataForAnalysis(selectedAccount);
    }
  }, [selectedAccount, tweetStyle]);

  // 从数据库加载用户数据进行分析
  const loadUserDataForAnalysis = async (usernameToLoad: string) => {
    try {
      setAnalyzing(true);
      setError("");

      const response = await fetch(`/api/twitter/get-user-data?username=${encodeURIComponent(usernameToLoad)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取数据失败');
      }

      if (data.success && data.data) {
        const userData = data.data;
        const tweets = userData.tweets;
        const topTweets = userData.topTweets;
        
        // Username is now tracked through selectedAccount
        
        // 转换顶级推文格式
        const convertedTopTweets = topTweets.slice(0, 10).map((tweet: any) => ({
          text: tweet.text,
          likes: tweet.like_count || 0,
          retweets: tweet.retweet_count || 0,
          replies: tweet.reply_count || 0,
          url: tweet.tweet_url || `https://twitter.com/${usernameToLoad}/status/${tweet.tweet_id}`
        }));
        setTopTweets(convertedTopTweets);
        
        // 基于数据库数据分析风格
        const avgLength = tweets.reduce((sum: number, tweet: any) => sum + tweet.text.length, 0) / tweets.length;
        const hashtagUsage = tweets.filter((tweet: any) => tweet.text.includes('#')).length / tweets.length;
        const mentionUsage = tweets.filter((tweet: any) => tweet.text.includes('@')).length / tweets.length;
        
        setTweetStyle({
          tone: hashtagUsage > 0.3 ? 'professional' : avgLength > 200 ? 'detailed' : 'casual',
          avgLength: Math.round(avgLength),
          commonWords: ['Web3', 'crypto', 'blockchain', 'DeFi', 'NFT'],
          writingPatterns: [
            avgLength > 200 ? '详细解释' : '简洁表达',
            hashtagUsage > 0.3 ? '频繁使用标签' : '少用标签',
            mentionUsage > 0.2 ? '经常@他人' : '独立发声'
          ]
        });
      }
    } catch (err: any) {
      console.error('Error loading user data:', err);
      setError(err.message || '获取数据失败');
      if (err.message.includes('不存在')) {
        setError('该用户数据不存在，请先在首页获取用户数据');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAccountSelect = (username: string) => {
    setSelectedAccount(username);
    // Clear previous analysis when switching accounts
    setTweetStyle(null);
    setTopTweets([]);
    setRewrittenTweets([]);
  };

  const handleRefreshAccounts = () => {
    // 刷新账号列表的逻辑会在 AccountSelector 组件内部处理
  };

  const rewriteTweet = async (originalTweet: string, targetTone: string = selectedTone) => {
    if (!originalTweet.trim()) {
      setError("请输入要重写的推文内容");
      return;
    }

    if (!tweetStyle && targetTone === "auto") {
      setError("请先分析目标账号的写作风格，或选择特定的语调");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/rewrite-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalTweet,
          targetTone,
          username: targetTone === "auto" ? username : null,
          style: targetTone === "auto" ? tweetStyle : null
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "重写失败");
      }

      if (data.success) {
        const newRewrite = {
          original: originalTweet,
          rewritten: data.rewrittenTweet,
          tone: data.appliedTone || targetTone,
          confidence: data.confidence || 85,
          improvements: data.improvements || []
        };

        setRewrittenTweets(prev => [newRewrite, ...prev]);
        if (originalTweet === customTweet) {
          setCustomTweet(""); // Clear input after successful rewrite
        }
      }
    } catch (error: any) {
      console.error("Tweet rewrite error:", error);
      setError(error.message || "重写失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getToneColor = (tone: string) => {
    const colors: { [key: string]: string } = {
      professional: "bg-blue-100 text-blue-800",
      casual: "bg-green-100 text-green-800", 
      humorous: "bg-yellow-100 text-yellow-800",
      technical: "bg-purple-100 text-purple-800",
      inspirational: "bg-pink-100 text-pink-800",
      auto: "bg-gray-100 text-gray-800"
    };
    return colors[tone] || colors.auto;
  };

  const predefinedTones = [
    { value: "auto", label: "🎯 模仿目标账号", description: "基于分析的账号风格" },
    { value: "professional", label: "💼 专业商务", description: "正式、权威、可信" },
    { value: "casual", label: "😊 轻松随意", description: "友善、亲近、自然" },
    { value: "humorous", label: "😄 幽默风趣", description: "有趣、活泼、吸引人" },
    { value: "technical", label: "🔬 技术专业", description: "精确、深入、专业" },
    { value: "inspirational", label: "✨ 激励启发", description: "积极、鼓舞、向上" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-8 items-center">
        {/* Header */}
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href="/">Twitter Analytics Pro</Link>
              <Badge variant="secondary" className="text-xs">AI 推文重写</Badge>
            </div>
            <ClientAuthButton />
          </div>
        </nav>

        <div className="flex-1 flex flex-col gap-8 max-w-6xl p-5 w-full">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <SparklesIcon className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">AI 推文重写大师</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              基于热门推文分析，智能模仿目标账号的语调和风格，重写优化您的推文内容
            </p>
          </div>

          {/* Account Selector */}
          <AccountSelector
            selectedAccount={selectedAccount}
            onAccountSelect={handleAccountSelect}
            onRefreshAccounts={handleRefreshAccounts}
            title="AI 推文重写分析"
            description="选择要分析的账号，基于历史推文数据学习写作风格"
          />

          {/* Loading indicator */}
          {analyzing && (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">正在分析推文风格...</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Style Analysis */}
            <div className="space-y-6">
              {/* Style Analysis Results */}
              {tweetStyle && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BrainIcon className="h-5 w-5" />
                      风格分析结果
                    </CardTitle>
                    <CardDescription>
                      基于 @{selectedAccount} 的历史推文分析得出的写作风格
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <TargetIcon className="h-4 w-4" />
                          风格特征分析
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">语调风格:</span>
                            <Badge className={`ml-2 ${getToneColor(tweetStyle.tone)}`}>
                              {tweetStyle.tone}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">平均长度:</span>
                            <span className="ml-2 font-medium">{tweetStyle.avgLength} 字符</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">表情符号:</span>
                            <span className="ml-2">{tweetStyle.emojiUsage ? "✅ 经常使用" : "❌ 较少使用"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">标签风格:</span>
                            <span className="ml-2 font-medium">{tweetStyle.hashtagStyle}</span>
                          </div>
                        </div>

                        {tweetStyle.keywords && tweetStyle.keywords.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm text-muted-foreground mb-2">常用关键词:</p>
                            <div className="flex flex-wrap gap-2">
                              {tweetStyle.keywords.slice(0, 8).map((keyword, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {tweetStyle.commonPatterns.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm text-muted-foreground mb-2">写作模式:</p>
                            <ul className="text-xs space-y-1">
                              {tweetStyle.commonPatterns.slice(0, 3).map((pattern, i) => (
                                <li key={i} className="text-muted-foreground">• {pattern}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Tweets */}
              {topTweets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUpIcon className="h-4 w-4" />
                      热门推文参考
                    </CardTitle>
                    <CardDescription>
                      @{selectedAccount} 的高互动推文，可用作重写参考
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {topTweets.map((tweet, index) => (
                          <Card key={tweet.id} className="border-l-4 border-l-primary">
                            <CardContent className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => rewriteTweet(tweet.text)}
                                    className="h-6 text-xs"
                                  >
                                    <WandIcon className="h-3 w-3 mr-1" />
                                    重写这条
                                  </Button>
                                </div>
                                <p className="text-sm line-clamp-2">{tweet.text}</p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1">
                                      <HeartIcon className="h-3 w-3" />
                                      {formatNumber(tweet.public_metrics.like_count)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <RepeatIcon className="h-3 w-3" />
                                      {formatNumber(tweet.public_metrics.retweet_count)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <MessageSquareIcon className="h-3 w-3" />
                                      {formatNumber(tweet.public_metrics.reply_count)}
                                    </span>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    得分: {tweet.engagement_score.toFixed(0)}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Tweet Rewriting */}
            <div className="space-y-6">
              {/* Rewrite Interface */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <WandIcon className="h-5 w-5" />
                    智能推文重写
                  </CardTitle>
                  <CardDescription>
                    输入您的推文内容，AI将根据分析的风格进行重写优化
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tone Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">选择语调风格:</label>
                    <Select value={selectedTone} onValueChange={setSelectedTone}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {predefinedTones.map((tone) => (
                          <SelectItem key={tone.value} value={tone.value}>
                            <div className="flex flex-col items-start">
                              <span>{tone.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {tone.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tweet Input */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">输入推文内容:</label>
                    <Textarea
                      placeholder="在这里输入您想要重写的推文内容..."
                      value={customTweet}
                      onChange={(e) => setCustomTweet(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      {customTweet.length} 字符
                    </div>
                  </div>

                  <Button 
                    onClick={() => rewriteTweet(customTweet)}
                    disabled={loading || !customTweet.trim()}
                    className="w-full"
                  >
                    {loading ? (
                      <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <SparklesIcon className="h-4 w-4 mr-2" />
                    )}
                    {loading ? "AI重写中..." : "开始重写"}
                  </Button>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Rewritten Results */}
              {rewrittenTweets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ZapIcon className="h-5 w-5" />
                      重写结果 ({rewrittenTweets.length})
                    </CardTitle>
                    <CardDescription>
                      AI优化后的推文内容，点击复制即可使用
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {rewrittenTweets.map((result, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={getToneColor(result.tone)}>
                                {result.tone}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                置信度: {result.confidence}%
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(result.rewritten, index)}
                            >
                              {copiedIndex === index ? (
                                <CheckIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <CopyIcon className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">原文:</p>
                              <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                {result.original}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">重写后:</p>
                              <p className="text-sm p-2 rounded border">
                                {result.rewritten}
                              </p>
                            </div>
                          </div>

                          {result.improvements.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">优化点:</p>
                              <div className="flex flex-wrap gap-1">
                                {result.improvements.map((improvement, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {improvement}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Loading State */}
          {analyzing && (
            <Card>
              <CardContent className="p-8 text-center">
                <BrainIcon className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">正在分析账号风格...</h3>
                <p className="text-muted-foreground">
                  AI正在学习该账号的写作风格和语调特征
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}