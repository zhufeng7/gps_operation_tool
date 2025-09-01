"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  SearchIcon, 
  DownloadIcon, 
  ImageIcon, 
  CalendarIcon,
  ExternalLinkIcon,
  XIcon,
  SettingsIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HomeIcon
} from "lucide-react";
import Link from "next/link";
import { ClientAuthButton } from "@/components/client-auth-button";
import { TweetImage } from "@/components/tweet-image";
import { AccountSelector } from "@/components/account-selector";

interface TweetMedia {
  id: string;
  url: string;
  type: string;
  width?: number;
  height?: number;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  url: string;
  media: TweetMedia[];
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
  };
}

interface SearchResult {
  username: string;
  totalTweets: number;
  mediaTweets: number;
  searchTime: string;
  tweets: Tweet[];
  // 新增数据完整性字段
  stats?: {
    pagesProcessed?: number;
    totalProcessed?: number;
    hasMoreData?: boolean;
  };
  searchMeta?: {
    timeRange?: {
      startTime: string;
      endTime: string;
      months: number;
    };
    pagination?: {
      maxResults: number;
      maxPages: number;
      pagesProcessed: number;
      hasMoreData: boolean;
    };
  };
}

export default function MediaSearchPage() {
  const router = useRouter();
  
  const [selectedAccount, setSelectedAccount] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [displayCount, setDisplayCount] = useState(20);
  const [showAll, setShowAll] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // 当选择账号时自动加载数据
  useEffect(() => {
    if (selectedAccount && hasMounted) {
      loadMediaTweets(selectedAccount);
    }
  }, [selectedAccount, hasMounted]);

  // 从数据库加载媒体推文
  const loadMediaTweets = async (username: string) => {
    if (!username) return;
    
    try {
      setIsSearching(true);
      setError(null);
      setResults(null);

      const response = await fetch(`/api/twitter/get-media-tweets?username=${encodeURIComponent(username)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取数据失败');
      }

      if (data.success) {
        setResults(data.data);
      } else {
        throw new Error(data.error || '获取数据失败');
      }
    } catch (err: any) {
      console.error('Error loading media tweets:', err);
      setError(err.message || '获取数据失败');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAccountSelect = (username: string) => {
    setSelectedAccount(username);
  };

  const handleRefreshAccounts = () => {
    // 刷新账号列表的逻辑会在 AccountSelector 组件内部处理
  };

  const handleDownloadCSV = () => {
    if (!results || !hasMounted) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    const csvContent = [
      ['推文链接', '发布时间', '内容摘要', '点赞数', '转发数', '回复数', '媒体链接'].join(','),
      ...results.tweets.map(tweet => [
        tweet.url,
        new Date(tweet.created_at).toLocaleDateString('zh-CN'),
        `"${tweet.text.substring(0, 100)}..."`,
        tweet.public_metrics.like_count,
        tweet.public_metrics.retweet_count,
        tweet.public_metrics.reply_count,
        tweet.media.map(m => m.url).join(' | ')
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${results.username}_media_tweets_${today}.csv`;
    link.click();
  };

  const handleDownloadJSON = () => {
    if (!results || !hasMounted) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    const jsonContent = JSON.stringify(results, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${results.username}_media_tweets_${today}.json`;
    link.click();
  };


  const handleClear = () => {
    setSelectedAccount("");
    setResults(null);
    setDisplayCount(20);
    setShowAll(false);
  };

  const handleLoadMore = () => {
    if (!results) return;
    
    if (displayCount >= results.tweets.length) {
      setShowAll(true);
      return;
    }
    
    const nextCount = Math.min(displayCount + 20, results.tweets.length);
    setDisplayCount(nextCount);
    
    if (nextCount >= results.tweets.length) {
      setShowAll(true);
    }
  };

  const handleShowAll = () => {
    if (!results) return;
    setDisplayCount(results.tweets.length);
    setShowAll(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="w-full flex justify-center border-b border-border h-16">
        <div className="w-full max-w-6xl flex justify-between items-center p-3 px-5">
          <div className="flex gap-5 items-center font-semibold">
            <Link href="/" className="flex items-center gap-2">
              <HomeIcon className="h-4 w-4" />
              Twitter Analytics Pro
            </Link>
            <span className="text-muted-foreground">/</span>
            <span>图片推文分析</span>
          </div>
          <ClientAuthButton />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Search Section */}
        <AccountSelector
          selectedAccount={selectedAccount}
          onAccountSelect={handleAccountSelect}
          onRefreshAccounts={handleRefreshAccounts}
          title="图片推文分析"
          description="选择要分析的账号，查看含图片的推文数据"
        />
        
        {results && (
          <Card>
            <CardContent>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleClear}
                  disabled={isSearching}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading indicator */}
        {isSearching && (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">正在加载媒体推文数据...</p>
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

        {/* Results Section */}
        {results && (
          <>
            {/* Stats Section */}
            <Card>
              <CardHeader>
                <CardTitle>📊 统计信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {results.totalTweets.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">总推文数</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {results.mediaTweets.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">含图片</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round((results.mediaTweets / results.totalTweets) * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">图片比例</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">检索时间</div>
                    <div className="text-xs text-muted-foreground">
                      {results.searchTime}
                    </div>
                  </div>
                </div>

                {/* 数据完整性信息 */}
                {(results.stats || results.searchMeta) && (
                  <div className="mt-6 pt-4 border-t space-y-3">
                    <h4 className="font-medium text-sm">🔍 数据完整性检查</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {results.searchMeta?.pagination && (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">搜索深度:</span>
                            <span>{results.searchMeta.pagination.pagesProcessed}/{results.searchMeta.pagination.maxPages} 页</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">处理推文:</span>
                            <span>{results.stats?.totalProcessed?.toLocaleString()} 条</span>
                          </div>
                        </div>
                      )}
                      
                      {results.searchMeta?.timeRange && (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">时间范围:</span>
                            <span>{results.searchMeta.timeRange.months} 个月</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">起始时间:</span>
                            <span className="text-xs">
                              {new Date(results.searchMeta.timeRange.startTime).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 完整性状态 */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        {results.stats?.hasMoreData ? (
                          <>
                            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                            <span className="text-sm text-amber-700">数据可能不完整</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-sm text-green-700">数据检索完整</span>
                          </>
                        )}
                      </div>
                      
                      {results.stats?.hasMoreData && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAdvanced(true)}
                          className="text-xs"
                        >
                          调整搜索参数
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Download Section */}
            <Card>
              <CardHeader>
                <CardTitle>📥 下载选项</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleDownloadCSV} variant="outline">
                    <DownloadIcon className="h-4 w-4 mr-2" />
                    下载 CSV
                  </Button>
                  <Button onClick={handleDownloadJSON} variant="outline">
                    <DownloadIcon className="h-4 w-4 mr-2" />
                    下载 JSON
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview Section */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>📷 图片推文预览</CardTitle>
                    <CardDescription>
                      {showAll ? 
                        `显示全部 ${results.mediaTweets} 条含图片推文` : 
                        `显示前 ${Math.min(displayCount, results.mediaTweets)} 条，共 ${results.mediaTweets} 条含图片推文`
                      }
                    </CardDescription>
                  </div>
                  {!showAll && results.tweets.length > displayCount && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleLoadMore}
                      >
                        加载更多 (+20)
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleShowAll}
                      >
                        显示全部 ({results.mediaTweets})
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* 图片说明 */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-2">
                    <ImageIcon className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-900">图片显示说明</p>
                      <p className="text-blue-700 mt-1">
                        由于Twitter API限制，当前显示的是示例图片。点击左上角的链接图标可查看原始推文和真实图片。
                        每张图片都对应一条真实的含图片推文。
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.tweets.slice(0, displayCount).map((tweet, index) => (
                    <Card key={tweet.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        {/* Tweet Image */}
                        <TweetImage
                          src={tweet.media[0]?.url || '/placeholder-image.jpg'}
                          alt={tweet.media[0]?.alt_text || "推文图片"}
                          tweetUrl={tweet.url}
                          index={index}
                        />
                        
                        {/* Tweet Content */}
                        <p className="text-sm line-clamp-3 mb-3">
                          {tweet.text}
                        </p>
                        
                        {/* Tweet Stats */}
                        <div className="flex justify-between text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {new Date(tweet.created_at).toLocaleDateString('zh-CN')}
                          </span>
                          <div className="flex gap-2">
                            <span>❤️ {tweet.public_metrics.like_count}</span>
                            <span>🔄 {tweet.public_metrics.retweet_count}</span>
                          </div>
                        </div>
                        
                        {/* View Tweet Button */}
                        <a
                          href={tweet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-primary hover:underline"
                        >
                          <ExternalLinkIcon className="h-3 w-3 mr-1" />
                          查看原推文
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Load More Section */}
                {!showAll && results.tweets.length > displayCount && (
                  <div className="text-center mt-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      已显示 {displayCount} 条，剩余 {results.tweets.length - displayCount} 条
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button onClick={handleLoadMore} variant="outline">
                        加载更多 (+20)
                      </Button>
                      <Button onClick={handleShowAll} variant="default">
                        显示全部 {results.mediaTweets} 条
                      </Button>
                    </div>
                  </div>
                )}
                
                {showAll && (
                  <div className="text-center mt-6">
                    <p className="text-sm text-green-600 font-medium">
                      ✅ 已显示全部 {results.mediaTweets} 条含图片推文
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      数据确保完整性，与统计数量一致
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}