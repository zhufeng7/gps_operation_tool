'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SearchIcon, BarChart3Icon, ImageIcon, SparklesIcon, LoaderIcon, CheckCircleIcon } from "lucide-react";
import { ClientAuthButton } from "@/components/client-auth-button";

interface FetchStatus {
  stage: 'idle' | 'analyzing' | 'collecting' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  details?: string;
}

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>({
    stage: 'idle',
    progress: 0,
    message: '',
    details: ''
  });
  const [collectionResult, setCollectionResult] = useState<any>(null);
  const router = useRouter();

  const handleFetchData = async () => {
    if (!username.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setCollectionResult(null);
    
    try {
      const normalizedUsername = username.trim().replace(/^@/, '');
      
      setFetchStatus({
        stage: 'analyzing',
        progress: 10,
        message: '正在分析账号信息...',
        details: `检查 @${normalizedUsername} 的基本信息`
      });

      const response = await fetch('/api/twitter/collect-tweets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: normalizedUsername }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '数据收集失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setFetchStatus(prev => ({
                    ...prev,
                    stage: data.stage || prev.stage,
                    progress: data.progress || prev.progress,
                    message: data.message || prev.message,
                    details: data.details || prev.details
                  }));
                } else if (data.type === 'result') {
                  setCollectionResult(data.data);
                  setFetchStatus({
                    stage: 'completed',
                    progress: 100,
                    message: '数据收集完成！',
                    details: `成功收集 ${data.data.tweetsCollected || 0} 条推文`
                  });
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to collect tweet data:', err);
      setError(err.message || '数据收集失败');
      setFetchStatus({
        stage: 'error',
        progress: 0,
        message: '收集失败',
        details: err.message || '未知错误'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateToFeature = (path: string) => {
    router.push(path);
  };

  const getDataStatus = () => {
    if (isLoading) {
      return fetchStatus.message || "正在收集数据...";
    }
    if (error) return `错误: ${error}`;
    if (collectionResult) {
      return `✅ 已成功收集 @${collectionResult.username} 的 ${collectionResult.tweetsCollected} 条推文数据`;
    }
    return "输入Twitter用户名开始收集数据";
  };

  return (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20">
      <div className="flex-1 w-full flex flex-col gap-16 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <div className="flex gap-5 items-center font-semibold">
              <Link href={"/"} className="text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-bold">
                Twitter Analytics Pro
              </Link>
            </div>
            <ClientAuthButton />
          </div>
        </nav>
        
        <div className="flex-1 flex flex-col gap-16 max-w-5xl p-5 w-full">
          {/* Hero Section */}
          <div className="text-center space-y-6 pt-8">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent">
                推特数据收集与分析平台
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                收集并存储推特数据到数据库，提供 
                <span className="text-purple-600 font-semibold">多维度分析功能</span>
              </p>
              
              {/* Usage Instructions */}
              <div className="max-w-4xl mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-4">
                    💡 使用说明
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">📊</div>
                      <span className="text-gray-700 dark:text-gray-300">可直接使用分析功能查看已有数据</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-xl">
                      <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">🚀</div>
                      <span className="text-gray-700 dark:text-gray-300">收集新数据获取更多推文信息</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center space-x-2 pt-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse delay-150"></div>
              <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse delay-300"></div>
            </div>
          </div>

          {/* Data Fetch Section */}
          <div className="max-w-3xl mx-auto w-full">
            <Card className="border-0 shadow-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-teal-500/5"></div>
              <CardHeader className="relative pb-6">
                <CardTitle className="text-center text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  🚀 数据收集中心
                </CardTitle>
                <CardDescription className="text-center text-lg text-muted-foreground">
                  收集推特账号的历史数据并存储到数据库中
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="space-y-6">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="输入Twitter用户名 (如：elonmusk 或 @elonmusk)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleFetchData()}
                        disabled={isLoading}
                        className="h-12 text-lg border-2 border-purple-200 focus:border-purple-400 rounded-xl bg-white/80 dark:bg-gray-700/80"
                      />
                    </div>
                    <Button 
                      onClick={handleFetchData}
                      disabled={isLoading || !username.trim()}
                      className="px-8 h-12 text-lg font-semibold rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      {isLoading ? <LoaderIcon className="h-5 w-5 animate-spin mr-2" /> : <SearchIcon className="h-5 w-5 mr-2" />}
                      {isLoading ? '收集中' : '开始收集'}
                    </Button>
                  </div>
                  
                  <div className="text-center space-y-4">
                    {isLoading && (
                      <div className="w-full space-y-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
                        <Progress value={fetchStatus.progress} className="w-full h-3 bg-gray-200 dark:bg-gray-700" />
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {fetchStatus.stage === 'analyzing' && '🔍 分析账号信息'}
                          {fetchStatus.stage === 'collecting' && '📥 收集推文数据'}
                          {fetchStatus.stage === 'processing' && '⚙️ 存储数据库'}
                          {fetchStatus.stage === 'completed' && '✅ 收集完成'}
                          {fetchStatus.stage === 'error' && '❌ 收集失败'}
                        </div>
                        {fetchStatus.details && (
                          <div className="text-sm text-muted-foreground bg-white/50 dark:bg-gray-800/50 p-2 rounded-lg">
                            {fetchStatus.details}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`
                      inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300
                      ${error ? 'bg-red-100 text-red-700 border-2 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800' : 
                        collectionResult ? 'bg-green-100 text-green-700 border-2 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 shadow-lg' : 
                        isLoading ? 'bg-blue-100 text-blue-700 border-2 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' :
                        'bg-gray-100 text-gray-600 border-2 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'}
                    `}>
                      {collectionResult && <CheckCircleIcon className="h-5 w-5" />}
                      {error && <span className="text-lg">⚠️</span>}
                      {isLoading && <LoaderIcon className="h-5 w-5 animate-spin" />}
                      {!isLoading && !error && !collectionResult && <span className="text-lg">💾</span>}
                      <span>{getDataStatus()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Cards */}
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🎯 核心分析功能
              </h2>
              <p className="text-lg text-muted-foreground">
                基于数据库存储的推文数据，提供多维度深度分析
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1: Media Search */}
              <Card className="group relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer hover:scale-[1.03] bg-gradient-to-br from-teal-50 to-blue-100 dark:from-teal-900/20 dark:to-blue-900/20 rounded-2xl flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400/10 to-blue-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardHeader className="relative pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="p-2 bg-gradient-to-r from-teal-500 to-blue-500 rounded-xl shadow-lg">
                      <ImageIcon className="h-6 w-6 text-white" />
                    </div>
                    <span className="bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
                      图片推文检索
                    </span>
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-300">
                    检索数据库中的含图片推文，支持数据导出
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative flex flex-col h-full">
                  <ul className="text-sm text-muted-foreground space-y-3 mb-6 flex-grow">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                      数据库数据分析
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      CSV/JSON 格式导出
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                      图片缩略图预览
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      批量下载链接
                    </li>
                  </ul>
                  <Button 
                    className="w-full h-11 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mt-auto" 
                    onClick={() => handleNavigateToFeature('/media-search')}
                  >
                    <SearchIcon className="mr-2 h-5 w-5" />
                    开始检索
                  </Button>
                </CardContent>
              </Card>

              {/* Feature 2: Data Analysis */}
              <Card className="group relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer hover:scale-[1.03] bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400/10 to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardHeader className="relative pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg">
                      <BarChart3Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      数据深度分析
                    </span>
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-300">
                    基于数据库数据进行时间维度深度分析
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative flex flex-col h-full">
                  <ul className="text-sm text-muted-foreground space-y-3 mb-6 flex-grow">
                    <li className="flex items-center gap-2">
                      <span className="text-lg">📈</span>
                      详细时间分析表格
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      智能趋势识别
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      运营策略建议
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-lg">📊</span>
                      可视化数据图表
                    </li>
                  </ul>
                  <Button 
                    className="w-full h-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mt-auto"
                    onClick={() => handleNavigateToFeature('/analytics/time-analysis-v3')}
                  >
                    <BarChart3Icon className="mr-2 h-5 w-5" />
                    开始分析
                  </Button>
                </CardContent>
              </Card>

              {/* Feature 3: AI Tweet Rewriter */}
              <Card className="group relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-500 cursor-pointer hover:scale-[1.03] bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <CardHeader className="relative pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold">
                    <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg relative">
                      <SparklesIcon className="h-6 w-6 text-white" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        AI推文重写
                      </span>
                      <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full font-bold shadow-md">
                        AI
                      </span>
                    </div>
                  </CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-300">
                    基于数据库数据分析账号风格，智能重写推文
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative flex flex-col h-full">
                  <ul className="text-sm text-muted-foreground space-y-3 mb-6 flex-grow">
                    <li className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      历史风格学习
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-lg">✨</span>
                      智能语调模仿
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-lg">🎨</span>
                      多种风格选择
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      一键内容重写
                    </li>
                  </ul>
                  <Button 
                    className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mt-auto"
                    onClick={() => handleNavigateToFeature('/ai/tweet-rewriter')}
                  >
                    <SparklesIcon className="mr-2 h-5 w-5" />
                    AI重写
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 成功提示 */}
          {collectionResult && (
            <div className="text-center">
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 rounded-2xl border-2 border-green-200 dark:border-green-800 shadow-lg animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-2 bg-green-500 rounded-full">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-lg">🎉 数据收集完成！</div>
                  <div className="text-sm opacity-80">现在可以使用上面的分析功能</div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <footer className="w-full mt-16 py-8 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>由</span>
              <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Twitter Analytics Pro
              </span>
              <span>强力驱动</span>
              <span className="text-red-500">❤️</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground/60">
              基于 Next.js 15 + Supabase + AI 打造的专业推特数据分析平台
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}