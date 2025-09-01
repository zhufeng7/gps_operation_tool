import { TwitterApi } from 'twitter-api-v2';

export class TwitterServiceV2 {
  private client: TwitterApi;
  private requestCount: number = 0;
  private windowStartTime: number = 0;
  private readonly MAX_REQUESTS_PER_15_MINUTES = 50; // 极保守设置：50次/15分钟，避免429错误
  
  constructor() {
    if (!process.env.TWITTER_BEARER_TOKEN) {
      throw new Error('TWITTER_BEARER_TOKEN is required');
    }
    
    this.client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
  }

  /**
   * 智能请求节流器 - 基于Twitter API v2 Pro限制
   */
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000; // 15分钟
    
    // 初始化时间窗口
    if (this.windowStartTime === 0) {
      this.windowStartTime = now;
    }
    
    // 检查是否需要重置15分钟窗口
    if (now - this.windowStartTime >= fifteenMinutes) {
      this.requestCount = 0;
      this.windowStartTime = now;
      console.log(`🔄 [TwitterAPI] 15-minute window reset, quota refreshed`);
    }
    
    // 检查是否达到15分钟限制
    if (this.requestCount >= this.MAX_REQUESTS_PER_15_MINUTES) {
      const timeRemaining = fifteenMinutes - (now - this.windowStartTime);
      console.log(`🛡️ [TwitterAPI] 15-minute quota reached (${this.requestCount}/${this.MAX_REQUESTS_PER_15_MINUTES}), waiting ${Math.ceil(timeRemaining/1000)}s...`);
      await this.sleep(timeRemaining + 1000); // 多等1秒保险
      this.requestCount = 0;
      this.windowStartTime = Date.now();
    }
    
    this.requestCount++;
    const remainingQuota = this.MAX_REQUESTS_PER_15_MINUTES - this.requestCount;
    const windowElapsed = Math.round((now - this.windowStartTime) / 1000);
    console.log(`📊 [TwitterAPI] Request ${this.requestCount}/${this.MAX_REQUESTS_PER_15_MINUTES} (${remainingQuota} remaining, ${windowElapsed}s elapsed)`);
  }
  
  /**
   * 获取当前API配额状态
   */
  public getQuotaStatus() {
    const now = Date.now();
    const windowElapsed = this.windowStartTime > 0 ? now - this.windowStartTime : 0;
    const remaining = this.MAX_REQUESTS_PER_15_MINUTES - this.requestCount;
    
    return {
      used: this.requestCount,
      remaining,
      total: this.MAX_REQUESTS_PER_15_MINUTES,
      windowElapsed: Math.round(windowElapsed / 1000),
      canMakeMoreRequests: remaining > 0
    };
  }

  /**
   * Sleep function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Advanced retry mechanism with intelligent backoff
   */
  private async retryWithIntelligentBackoff<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 2  // 重试两次即停止
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error: any) {
        lastError = error;
        console.log(`[TwitterAPI] ${operationName} - Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (error.code === 429) {
          // 速率限制错误 - 快速重试策略
          const waitTime = 3000; // 等待3秒再重试
          console.log(`[TwitterAPI] Rate limit hit, waiting ${waitTime/1000}s before retry...`);
          
          if (attempt < maxRetries) {
            await this.sleep(waitTime);
            continue;
          }
        } else if (error.code === 401 || error.code === 403) {
          // 认证或权限错误，不重试
          console.log(`[TwitterAPI] Auth error ${error.code}, not retrying`);
          throw error;
        } else if (error.code === 404) {
          // 资源不存在，不重试
          console.log(`[TwitterAPI] Resource not found (404), not retrying`);
          throw error;
        } else {
          // 其他错误，短暂重试
          const delay = 2000 * attempt; // 2s, 4s, 6s...
          console.log(`[TwitterAPI] Retrying ${operationName} after ${delay}ms due to: ${error.message}`);
          if (attempt < maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }
        
        if (attempt === maxRetries) {
          console.error(`[TwitterAPI] ${operationName} failed after ${maxRetries} attempts`);
          throw lastError;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get user information by username with comprehensive fields
   */
  async getUserByUsername(username: string) {
    await this.throttleRequest(); // 应用节流
    
    return await this.retryWithIntelligentBackoff(async () => {
      const user = await this.client.v2.userByUsername(username, {
        'user.fields': [
          'id',
          'name', 
          'username',
          'description',
          'location',
          'url',
          'profile_image_url',
          'public_metrics',
          'verified',
          'created_at',
          'protected'
        ]
      });
      
      if (!user.data) {
        throw new Error(`User not found or suspended: ${username}`);
      }
      
      return user.data;
    }, `getUserByUsername(${username})`);
  }

  /**
   * 最大化推文数据收集 - 核心方法
   * 采用积极的数据收集策略，尽可能获取所有可访问的历史推文
   */
  async maximizeUserTweetCollection(userId: string, username: string): Promise<{
    tweets: any[];
    metadata: {
      totalCollected: number;
      pagesProcessed: number; 
      oldestTweetDate: string | null;
      newestTweetDate: string | null;
      timeSpanDays: number;
      hasMoreData: boolean;
      collectionStrategy: string;
      rateLimitHits: number;
      errors: string[];
    };
  }> {
    console.log(`\n🚀 [TwitterAPI] Starting MAXIMUM data collection for @${username} (${userId})`);
    console.log(`📊 [TwitterAPI] Strategy: Unlimited historical data collection`);
    
    const allTweets: any[] = [];
    const allMediaIncludes: any[] = [];
    const errors: string[] = [];
    let nextToken: string | undefined = undefined;
    let pagesProcessed = 0;
    let rateLimitHits = 0;
    let hasMoreData = false;
    
    // 第一阶段：普通推文收集（无媒体过滤）
    console.log(`\n📋 Phase 1: Collecting ALL tweets (unlimited history)`);
    
    const maxPages = 200; // 基于280次/15分钟的限制，最多200页，留余量给其他API调用
    let shouldStop = false; // 添加停止标志
    const tweetsPerPage = 100; // Twitter API 最大值
    const targetTweetCount = 15000; // 提高目标到15000条推文，获取更完整的数据
    let consecutiveEmptyPages = 0; // 连续空页面计数器
    const maxEmptyPages = 3; // 连续3个空页面就停止
    
    try {
      do {
        const params: any = {
          max_results: tweetsPerPage,
          'tweet.fields': [
            'id',
            'text', 
            'created_at',
            'author_id',
            'conversation_id',
            'public_metrics',
            'attachments',
            'referenced_tweets',
            'lang',
            'context_annotations',
            'entities',
            'geo',
            'in_reply_to_user_id',
            'possibly_sensitive',
            'source'
          ],
          'media.fields': [
            'media_key',
            'type',
            'url',
            'preview_image_url', 
            'width',
            'height',
            'duration_ms',
            'alt_text',
            'public_metrics'
          ],
          'user.fields': [
            'id',
            'username',
            'name',
            'public_metrics'
          ],
          'expansions': [
            'attachments.media_keys',
            'author_id',
            'referenced_tweets.id',
            'referenced_tweets.id.author_id'
          ],
          // 不设置任何时间限制，让API自然返回历史数据
          // exclude: ['replies'] // 暂时保留replies以获取更多数据
        };

        if (nextToken) {
          params.pagination_token = nextToken;
        }

        console.log(`📄 [TwitterAPI] Collecting page ${pagesProcessed + 1}/${maxPages}...`);

        try {
          // 在API调用前应用节流
          await this.throttleRequest();
          
          const response = await this.retryWithIntelligentBackoff(async () => {
            return await this.client.v2.userTimeline(userId, params);
          }, `userTimeline page ${pagesProcessed + 1}`);

          if (response.data?.data && response.data.data.length > 0) {
            allTweets.push(...response.data.data);
            consecutiveEmptyPages = 0; // 重置空页面计数器
            console.log(`✅ [TwitterAPI] Page ${pagesProcessed + 1}: ${response.data.data.length} tweets collected (Total: ${allTweets.length})`);
            
            // 如果已达到目标数量，提前停止收集
            if (allTweets.length >= targetTweetCount) {
              console.log(`🎯 [TwitterAPI] Target of ${targetTweetCount} tweets reached (${allTweets.length}), stopping early`);
              shouldStop = true;
              break;
            }
          } else {
            consecutiveEmptyPages++;
            console.log(`⚠️ [TwitterAPI] Page ${pagesProcessed + 1}: No tweets returned (Empty pages: ${consecutiveEmptyPages}/${maxEmptyPages})`);
            
            // 连续空页面检查
            if (consecutiveEmptyPages >= maxEmptyPages) {
              console.log(`🛑 [TwitterAPI] ${maxEmptyPages} consecutive empty pages, likely reached end of timeline. Stopping collection.`);
              shouldStop = true;
              break;
            }
          }

          // 收集媒体信息
          if (response.includes?.media && response.includes.media.length > 0) {
            allMediaIncludes.push(...response.includes.media);
            console.log(`🖼️ [TwitterAPI] Page ${pagesProcessed + 1}: ${response.includes.media.length} media items collected`);
          }

          nextToken = response.data?.meta?.next_token;
          hasMoreData = !!nextToken;
          pagesProcessed++;

          // 分析收集的时间范围
          if (response.data?.data && response.data.data.length > 0) {
            const oldestInPage = response.data.data[response.data.data.length - 1];
            const newestInPage = response.data.data[0];
            console.log(`⏰ [TwitterAPI] Page ${pagesProcessed} time range: ${oldestInPage.created_at} to ${newestInPage.created_at}`);
          }

          // 延迟管理由节流器统一处理，无需额外延迟

        } catch (error: any) {
          if (error.code === 429) {
            rateLimitHits++;
            console.log(`⚠️ [TwitterAPI] Rate limit hit on page ${pagesProcessed + 1}`);
            errors.push(`Rate limit on page ${pagesProcessed + 1}`);
            
            // 如果已经收集到一些数据，就停止继续收集，保存已有数据
            if (allTweets.length > 0) {
              console.log(`✅ [TwitterAPI] Already collected ${allTweets.length} tweets, stopping due to rate limit and saving data`);
              shouldStop = true;
              break;
            }
            
            // 如果没有数据，等待5秒后继续尝试
            console.log(`📊 [TwitterAPI] No data collected yet, waiting 5s before continuing...`);
            await this.sleep(5000); // 固定5秒等待
            continue;
          } else {
            console.error(`❌ [TwitterAPI] Error on page ${pagesProcessed + 1}:`, error.message);
            errors.push(`Page ${pagesProcessed + 1}: ${error.message}`);
            
            // 对于非速率限制错误，如果已经有数据就停止，否则继续尝试一次
            if (allTweets.length > 0) {
              console.log(`📊 [TwitterAPI] Non-rate-limit error, stopping with ${allTweets.length} tweets collected`);
              shouldStop = true;
              break;
            } else {
              break; // 没有数据时停止
            }
          }
        }

      } while (nextToken && pagesProcessed < maxPages && !shouldStop);

    } catch (globalError: any) {
      console.error(`💥 [TwitterAPI] Global collection error:`, globalError.message);
      errors.push(`Global error: ${globalError.message}`);
      
      // 即使发生全局错误，也要保存已收集的数据
      if (allTweets.length > 0) {
        console.log(`🔄 [TwitterAPI] Global error occurred, but ${allTweets.length} tweets were collected and will be saved`);
      }
    }
    
    // 确保无论如何都要保存已收集的数据
    console.log(`📊 [TwitterAPI] Final collection status: ${allTweets.length} tweets, ${pagesProcessed} pages processed`);
    
    // 即使没有收集到推文，也要返回基本结构以避免后续错误
    if (allTweets.length === 0) {
      console.warn(`⚠️ [TwitterAPI] No tweets collected for @${username}, but returning valid structure`);
    }

    // 计算时间范围和统计数据
    let oldestTweetDate: string | null = null;
    let newestTweetDate: string | null = null;
    let timeSpanDays = 0;

    if (allTweets.length > 0) {
      const sortedTweets = [...allTweets].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      oldestTweetDate = sortedTweets[0].created_at;
      newestTweetDate = sortedTweets[sortedTweets.length - 1].created_at;
      
      const oldestDate = new Date(oldestTweetDate);
      const newestDate = new Date(newestTweetDate);
      timeSpanDays = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 处理推文数据，合并媒体信息
    const processedTweets = allTweets.map(tweet => {
      let mediaData: any[] = [];
      
      if (tweet.attachments?.media_keys && allMediaIncludes.length > 0) {
        mediaData = tweet.attachments.media_keys.map((mediaKey: string) => {
          const mediaItem = allMediaIncludes.find(m => m.media_key === mediaKey);
          return mediaItem ? {
            media_key: mediaItem.media_key,
            type: mediaItem.type,
            url: mediaItem.url || mediaItem.preview_image_url,
            width: mediaItem.width,
            height: mediaItem.height,
            duration_ms: mediaItem.duration_ms,
            alt_text: mediaItem.alt_text
          } : null;
        }).filter(Boolean);
      }

      return {
        ...tweet,
        media: mediaData,
        has_media: mediaData.length > 0,
        collection_timestamp: new Date().toISOString(),
        tweet_url: `https://twitter.com/${username}/status/${tweet.id}`
      };
    });

    const summary = {
      totalCollected: allTweets.length,
      pagesProcessed,
      oldestTweetDate,
      newestTweetDate, 
      timeSpanDays,
      hasMoreData,
      collectionStrategy: 'maximum_unlimited_historical',
      rateLimitHits,
      errors
    };

    console.log(`\n📊 [TwitterAPI] Collection Summary for @${username}:`);
    console.log(`   📝 Total tweets: ${summary.totalCollected}`);
    console.log(`   📄 Pages processed: ${summary.pagesProcessed}`);
    console.log(`   📅 Time span: ${summary.timeSpanDays} days (${Math.round(summary.timeSpanDays/30)} months)`);
    console.log(`   🔄 Rate limits hit: ${summary.rateLimitHits}`);
    console.log(`   ⚠️ Errors: ${summary.errors.length}`);
    console.log(`   🔗 Has more data: ${summary.hasMoreData ? 'Yes' : 'No'}`);
    
    if (summary.oldestTweetDate && summary.newestTweetDate) {
      console.log(`   ⏰ Date range: ${summary.oldestTweetDate} to ${summary.newestTweetDate}`);
    }

    return {
      tweets: processedTweets,
      metadata: summary
    };
  }

  /**
   * Search for user's media tweets with specific parameters
   */
  async searchUserMediaTweets(username: string, options: {
    maxResults?: number;
    maxPages?: number;
    months?: number;
    includeReplies?: boolean;
  } = {}): Promise<{
    user: any;
    tweets: any[];
    stats: {
      totalTweets: number;
      mediaTweets: number;
    };
  }> {
    console.log(`\n🎯 [TwitterAPI] Starting media tweet search for @${username}`);
    console.log(`📊 [TwitterAPI] Parameters:`, options);

    const { maxResults = 100, maxPages = 20, months = 6, includeReplies = false } = options;

    // Get user information
    const user = await this.getUserByUsername(username);
    console.log(`👤 [TwitterAPI] User found: ${user.name} (@${user.username})`);

    // Get tweets using maximizeUserTweetCollection with reasonable limits for media search
    const tweetCollection = await this.maximizeUserTweetCollection(user.id, user.username);
    
    // Filter for media tweets based on the search criteria
    let filteredTweets = tweetCollection.tweets.filter(tweet => {
      // Filter for media tweets
      const hasMedia = tweet.has_media && tweet.media && tweet.media.length > 0;
      
      // Apply time filter if specified
      let withinTimeRange = true;
      if (months > 0) {
        const tweetDate = new Date(tweet.created_at);
        const monthsAgo = new Date();
        monthsAgo.setMonth(monthsAgo.getMonth() - months);
        withinTimeRange = tweetDate >= monthsAgo;
      }
      
      // Apply replies filter
      let passesReplyFilter = true;
      if (!includeReplies) {
        passesReplyFilter = !tweet.in_reply_to_user_id;
      }
      
      return hasMedia && withinTimeRange && passesReplyFilter;
    });

    // Apply maxResults limit if specified
    if (maxResults > 0 && filteredTweets.length > maxResults) {
      filteredTweets = filteredTweets.slice(0, maxResults);
    }

    const stats = {
      totalTweets: tweetCollection.tweets.length,
      mediaTweets: filteredTweets.length
    };

    console.log(`📊 [TwitterAPI] Media search completed for @${username}:`);
    console.log(`   📝 Total tweets found: ${stats.totalTweets}`);
    console.log(`   🖼️ Media tweets found: ${stats.mediaTweets}`);

    return {
      user,
      tweets: filteredTweets,
      stats
    };
  }

  /**
   * 综合用户分析 - 使用最大化收集策略
   */
  async getComprehensiveUserAnalysis(username: string): Promise<{
    user: any;
    tweets: any[];
    stats: {
      totalTweets: number;
      mediaTweets: number;
      timeSpan: {
        days: number;
        months: number;
        years: number;
      };
      engagement: {
        avgLikes: number;
        avgRetweets: number;
        avgReplies: number;
        totalEngagement: number;
      };
      content: {
        hasMediaPercent: number;
        avgLength: number;
        languages: { [key: string]: number };
      };
    };
    metadata: any;
  }> {
    console.log(`\n🎯 [TwitterAPI] Starting comprehensive analysis for @${username}`);

    // 获取用户信息
    const user = await this.getUserByUsername(username);
    console.log(`👤 [TwitterAPI] User found: ${user.name} (@${user.username})`);
    console.log(`📊 [TwitterAPI] Public metrics: ${JSON.stringify(user.public_metrics)}`);

    // 获取最大化推文数据
    const tweetCollection = await this.maximizeUserTweetCollection(user.id, user.username);
    
    // 计算统计数据
    const tweets = tweetCollection.tweets;
    const totalTweets = tweets.length;
    const mediaTweets = tweets.filter(t => t.has_media).length;
    
    // 时间跨度计算
    const timeSpanDays = tweetCollection.metadata.timeSpanDays;
    const timeSpanMonths = Math.round(timeSpanDays / 30);
    const timeSpanYears = Math.round(timeSpanDays / 365);

    // 参与度统计
    const totalLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0);
    const totalReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || 0), 0);
    const totalEngagement = totalLikes + totalRetweets + totalReplies;

    // 内容分析
    const avgLength = tweets.length > 0 ? 
      tweets.reduce((sum, t) => sum + (t.text?.length || 0), 0) / tweets.length : 0;
    
    const languages: { [key: string]: number } = {};
    tweets.forEach(t => {
      const lang = t.lang || 'unknown';
      languages[lang] = (languages[lang] || 0) + 1;
    });

    const stats = {
      totalTweets,
      mediaTweets,
      timeSpan: {
        days: timeSpanDays,
        months: timeSpanMonths, 
        years: timeSpanYears
      },
      engagement: {
        avgLikes: totalTweets > 0 ? Math.round(totalLikes / totalTweets) : 0,
        avgRetweets: totalTweets > 0 ? Math.round(totalRetweets / totalTweets) : 0,
        avgReplies: totalTweets > 0 ? Math.round(totalReplies / totalTweets) : 0,
        totalEngagement
      },
      content: {
        hasMediaPercent: totalTweets > 0 ? Math.round((mediaTweets / totalTweets) * 100) : 0,
        avgLength: Math.round(avgLength),
        languages
      }
    };

    console.log(`\n📈 [TwitterAPI] Analysis complete for @${username}:`);
    console.log(`   📊 Total tweets analyzed: ${stats.totalTweets}`);
    console.log(`   🖼️ Media tweets: ${stats.mediaTweets} (${stats.content.hasMediaPercent}%)`);
    console.log(`   ⏰ Time span: ${stats.timeSpan.years} years, ${stats.timeSpan.months} months, ${stats.timeSpan.days} days`);
    console.log(`   💬 Avg engagement: ${stats.engagement.avgLikes} likes, ${stats.engagement.avgRetweets} retweets`);

    return {
      user,
      tweets,
      stats,
      metadata: tweetCollection.metadata
    };
  }
}