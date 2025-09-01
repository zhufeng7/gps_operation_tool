'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCwIcon, DatabaseIcon, TrendingUpIcon, CalendarIcon } from "lucide-react";

interface AccountInfo {
  id: string;
  username: string;
  displayName: string;
  profileImage?: string;
  stats: {
    followers: number;
    totalTweets: number;
    collectedTweets: number;
    mediaTweets: number;
    avgEngagement: number;
  };
  dataInfo: {
    latestTweetDate?: string;
    earliestTweetDate?: string;
    lastUpdated: string;
    timeSpanDays: number;
    dataFreshness: 'fresh' | 'recent' | 'valid' | 'stale';
  };
}

interface AccountSelectorProps {
  selectedAccount: string;
  onAccountSelect: (username: string) => void;
  onRefreshAccounts?: () => void;
  title?: string;
  description?: string;
  showStats?: boolean;
}

export function AccountSelector({ 
  selectedAccount, 
  onAccountSelect, 
  onRefreshAccounts,
  title = "选择分析账号",
  description = "从已收集数据的账号中选择一个进行分析",
  showStats = true
}: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    loadAvailableAccounts();
  }, []);

  const loadAvailableAccounts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch('/api/twitter/get-available-accounts');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '获取账号列表失败');
      }

      if (data.success) {
        setAccounts(data.data.accounts || []);
        
        // 如果没有选中账号但有可用账号，自动选择第一个
        if (!selectedAccount && data.data.accounts.length > 0) {
          onAccountSelect(data.data.accounts[0].username);
        }
      } else {
        throw new Error(data.error || '获取账号列表失败');
      }
    } catch (err: any) {
      console.error('Error loading accounts:', err);
      setError(err.message || '获取账号列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAvailableAccounts();
    onRefreshAccounts?.();
  };

  const selectedAccountInfo = accounts.find(acc => acc.username === selectedAccount);

  const getFreshnessColor = (freshness: string) => {
    switch (freshness) {
      case 'fresh': return 'bg-green-100 text-green-700';
      case 'recent': return 'bg-blue-100 text-blue-700';
      case 'valid': return 'bg-yellow-100 text-yellow-700';
      case 'stale': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getFreshnessText = (freshness: string) => {
    switch (freshness) {
      case 'fresh': return '最新';
      case 'recent': return '较新';
      case 'valid': return '有效';
      case 'stale': return '过期';
      default: return '未知';
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCwIcon className="h-4 w-4 animate-spin mr-2" />
            加载账号列表中...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            重试
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (accounts.length === 0) {
    return (
      <Alert>
        <DatabaseIcon className="h-4 w-4" />
        <AlertDescription>
          暂无已收集的账号数据。请先在首页收集推特数据。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select value={selectedAccount} onValueChange={onAccountSelect}>
              <SelectTrigger>
                <SelectValue placeholder="请选择要分析的账号" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.username}>
                    <div className="flex items-center gap-2">
                      {account.profileImage && (
                        <img 
                          src={account.profileImage} 
                          alt={account.displayName}
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <div className="flex flex-col">
                        <span className="font-medium">@{account.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(account.stats.collectedTweets)} 条推文
                        </span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`ml-auto text-xs ${getFreshnessColor(account.dataInfo.dataFreshness)}`}
                      >
                        {getFreshnessText(account.dataInfo.dataFreshness)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedAccountInfo && showStats && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    {selectedAccountInfo.profileImage && (
                      <img 
                        src={selectedAccountInfo.profileImage} 
                        alt={selectedAccountInfo.displayName}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div>
                      <CardTitle className="text-base">{selectedAccountInfo.displayName}</CardTitle>
                      <CardDescription>@{selectedAccountInfo.username}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">
                        {formatNumber(selectedAccountInfo.stats.followers)}
                      </div>
                      <div className="text-muted-foreground">粉丝数</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">
                        {formatNumber(selectedAccountInfo.stats.collectedTweets)}
                      </div>
                      <div className="text-muted-foreground">已收集</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-purple-600">
                        {formatNumber(selectedAccountInfo.stats.mediaTweets)}
                      </div>
                      <div className="text-muted-foreground">含媒体</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-orange-600">
                        {selectedAccountInfo.dataInfo.timeSpanDays}
                      </div>
                      <div className="text-muted-foreground">天跨度</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      更新: {new Date(selectedAccountInfo.dataInfo.lastUpdated).toLocaleString('zh-CN')}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={getFreshnessColor(selectedAccountInfo.dataInfo.dataFreshness)}
                    >
                      {getFreshnessText(selectedAccountInfo.dataInfo.dataFreshness)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}