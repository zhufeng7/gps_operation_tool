// Enhanced Twitter data cache for maximum data collection strategy
// Supports large-scale tweet data with better compression and persistence

export interface MaximizedCacheData {
  accounts: { [username: string]: CachedAccountData };
  globalMetadata: {
    lastUpdated: string;
    version: string;
    totalAccounts: number;
    totalTweets: number;
    cachingStrategy: string;
  };
}

export interface CachedAccountData {
  user: {
    id: string;
    username: string;
    name: string;
    description: string;
    profile_image_url: string;
    public_metrics: {
      followers_count: number;
      following_count: number;
      tweet_count: number;
      listed_count: number;
    };
    verified: boolean;
    created_at: string;
    url: string;
    location: string;
  };
  tweets: CachedTweet[];
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
  collectionMetadata: {
    totalCollected: number;
    pagesProcessed: number;
    oldestTweetDate: string | null;
    newestTweetDate: string | null;
    timeSpanDays: number;
    hasMoreData: boolean;
    collectionStrategy: string;
    rateLimitHits: number;
    errors: string[];
    collectionTime: string;
    apiVersion: string;
  };
}

export interface CachedTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    impression_count?: number;
  };
  lang: string;
  has_media: boolean;
  media: Array<{
    media_key: string;
    type: string;
    url: string;
    width?: number;
    height?: number;
    duration_ms?: number;
    alt_text?: string;
  }>;
  tweet_url: string;
  referenced_tweets?: Array<{
    type: string;
    id: string;
  }>;
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string }>;
    urls?: Array<{ url: string; expanded_url: string }>;
  };
  context_annotations?: Array<{
    domain: { name: string };
    entity: { name: string };
  }>;
  conversation_id: string;
  in_reply_to_user_id?: string;
  possibly_sensitive?: boolean;
  source?: string;
  collection_timestamp: string;
}

class MaximizedTwitterCache {
  private static readonly CACHE_KEY = 'twitter_maximized_cache_v2';
  private static readonly CACHE_EXPIRY_KEY = 'twitter_maximized_cache_expiry_v2';
  private static readonly CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours for large datasets
  private static readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit

  static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  }

  /**
   * Compress data for storage efficiency
   */
  private static compressData(data: MaximizedCacheData): string {
    // Simple compression by removing unnecessary whitespace and redundant data
    const compressed = {
      a: data.accounts, // accounts
      g: { // globalMetadata
        l: data.globalMetadata.lastUpdated,
        v: data.globalMetadata.version, 
        ta: data.globalMetadata.totalAccounts,
        tt: data.globalMetadata.totalTweets,
        s: data.globalMetadata.cachingStrategy
      }
    };
    return JSON.stringify(compressed);
  }

  /**
   * Decompress data after retrieval
   */
  private static decompressData(compressedStr: string): MaximizedCacheData {
    const compressed = JSON.parse(compressedStr);
    return {
      accounts: compressed.a,
      globalMetadata: {
        lastUpdated: compressed.g.l,
        version: compressed.g.v,
        totalAccounts: compressed.g.ta,
        totalTweets: compressed.g.tt,
        cachingStrategy: compressed.g.s
      }
    };
  }

  /**
   * Set account data with intelligent caching strategy
   */
  static setAccountData(username: string, accountData: CachedAccountData): void {
    if (!this.isBrowser()) return;

    try {
      // Get existing cache or create new
      let cacheData = this.getAllData() || {
        accounts: {},
        globalMetadata: {
          lastUpdated: new Date().toISOString(),
          version: 'v2_maximum_collection',
          totalAccounts: 0,
          totalTweets: 0,
          cachingStrategy: 'maximum_unlimited_historical'
        }
      };

      // Update account data
      cacheData.accounts[username.toLowerCase()] = accountData;
      
      // Update global metadata
      cacheData.globalMetadata.lastUpdated = new Date().toISOString();
      cacheData.globalMetadata.totalAccounts = Object.keys(cacheData.accounts).length;
      cacheData.globalMetadata.totalTweets = Object.values(cacheData.accounts)
        .reduce((total, acc) => total + acc.tweets.length, 0);

      // Check storage size before saving
      const compressedData = this.compressData(cacheData);
      const dataSize = new Blob([compressedData]).size;
      
      if (dataSize > this.MAX_STORAGE_SIZE) {
        console.warn('[MaxCache] Data size exceeds limit, implementing cleanup...');
        cacheData = this.performIntelligentCleanup(cacheData);
      }

      // Save to cache
      const finalCompressed = this.compressData(cacheData);
      const expiry = Date.now() + this.CACHE_DURATION;
      
      sessionStorage.setItem(this.CACHE_KEY, finalCompressed);
      sessionStorage.setItem(this.CACHE_EXPIRY_KEY, expiry.toString());

      console.log(`[MaxCache] Cached data for @${username}:`);
      console.log(`  - ${accountData.tweets.length} tweets`);
      console.log(`  - ${accountData.collectionMetadata.timeSpanDays} days span`);
      console.log(`  - Total cache size: ${Math.round(dataSize / 1024)}KB`);
      console.log(`  - Total accounts in cache: ${cacheData.globalMetadata.totalAccounts}`);

    } catch (error) {
      console.error('[MaxCache] Failed to cache account data:', error);
      // Attempt recovery by clearing cache
      this.clear();
    }
  }

  /**
   * Intelligent cleanup when cache size exceeds limits
   */
  private static performIntelligentCleanup(cacheData: MaximizedCacheData): MaximizedCacheData {
    console.log('[MaxCache] Performing intelligent cleanup...');
    
    const accounts = Object.entries(cacheData.accounts);
    
    // Sort accounts by data quality and recency 
    accounts.sort((a, b) => {
      const scoreA = this.calculateAccountCacheScore(a[1]);
      const scoreB = this.calculateAccountCacheScore(b[1]);
      return scoreB - scoreA; // Higher score = keep
    });

    // Keep top 70% of accounts
    const keepCount = Math.ceil(accounts.length * 0.7);
    const keptAccounts = accounts.slice(0, keepCount);
    
    console.log(`[MaxCache] Cleanup: keeping ${keepCount}/${accounts.length} accounts`);
    
    const cleanedCache: MaximizedCacheData = {
      accounts: Object.fromEntries(keptAccounts),
      globalMetadata: {
        ...cacheData.globalMetadata,
        lastUpdated: new Date().toISOString(),
        totalAccounts: keptAccounts.length,
        totalTweets: keptAccounts.reduce((total, [_, acc]) => total + acc.tweets.length, 0)
      }
    };

    return cleanedCache;
  }

  /**
   * Calculate cache score for account prioritization
   */
  private static calculateAccountCacheScore(accountData: CachedAccountData): number {
    const recencyScore = this.getRecencyScore(accountData.collectionMetadata.collectionTime);
    const dataQualityScore = accountData.tweets.length / 1000; // More tweets = higher score
    const timeSpanScore = accountData.collectionMetadata.timeSpanDays / 365; // Longer span = better
    const engagementScore = accountData.stats.engagement.totalEngagement / 10000;

    return recencyScore + dataQualityScore + timeSpanScore + engagementScore;
  }

  /**
   * Calculate recency score (0-1, 1 = most recent)
   */
  private static getRecencyScore(collectionTime: string): number {
    const collectionDate = new Date(collectionTime).getTime();
    const now = Date.now();
    const hoursAgo = (now - collectionDate) / (1000 * 60 * 60);
    
    // Score decreases over 24 hours
    return Math.max(0, 1 - (hoursAgo / 24));
  }

  /**
   * Get account data from cache
   */
  static getAccountData(username: string): CachedAccountData | null {
    const allData = this.getAllData();
    if (!allData) return null;

    return allData.accounts[username.toLowerCase()] || null;
  }

  /**
   * Get all cached data
   */
  static getAllData(): MaximizedCacheData | null {
    if (!this.isBrowser()) return null;

    try {
      const expiry = sessionStorage.getItem(this.CACHE_EXPIRY_KEY);
      if (!expiry || Date.now() > parseInt(expiry)) {
        console.log('[MaxCache] Cache expired, clearing...');
        this.clear();
        return null;
      }

      const compressedData = sessionStorage.getItem(this.CACHE_KEY);
      if (!compressedData) return null;

      const data = this.decompressData(compressedData);
      console.log(`[MaxCache] Retrieved cache with ${data.globalMetadata.totalAccounts} accounts, ${data.globalMetadata.totalTweets} tweets`);
      
      return data;
    } catch (error) {
      console.error('[MaxCache] Failed to retrieve cache:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Get all tweets from all cached accounts
   */
  static getAllTweets(): CachedTweet[] {
    const allData = this.getAllData();
    if (!allData) return [];

    return Object.values(allData.accounts)
      .flatMap(account => account.tweets);
  }

  /**
   * Get tweets by username
   */
  static getTweetsByUsername(username: string): CachedTweet[] {
    const accountData = this.getAccountData(username);
    return accountData ? accountData.tweets : [];
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    isValid: boolean;
    totalAccounts: number;
    totalTweets: number;
    cacheSize: string;
    lastUpdated: string;
    accounts: Array<{
      username: string;
      tweetsCount: number;
      timeSpanDays: number;
      collectionTime: string;
    }>;
  } | null {
    const allData = this.getAllData();
    if (!allData) {
      return {
        isValid: false,
        totalAccounts: 0,
        totalTweets: 0,
        cacheSize: '0KB',
        lastUpdated: 'Never',
        accounts: []
      };
    }

    // Calculate cache size
    const compressedData = sessionStorage.getItem(this.CACHE_KEY) || '';
    const cacheSize = Math.round(new Blob([compressedData]).size / 1024);

    return {
      isValid: true,
      totalAccounts: allData.globalMetadata.totalAccounts,
      totalTweets: allData.globalMetadata.totalTweets,
      cacheSize: `${cacheSize}KB`,
      lastUpdated: allData.globalMetadata.lastUpdated,
      accounts: Object.entries(allData.accounts).map(([username, data]) => ({
        username,
        tweetsCount: data.tweets.length,
        timeSpanDays: data.collectionMetadata.timeSpanDays,
        collectionTime: data.collectionMetadata.collectionTime
      }))
    };
  }

  /**
   * Check if account data exists and is recent
   */
  static hasRecentAccountData(username: string, maxAgeHours: number = 2): boolean {
    const accountData = this.getAccountData(username);
    if (!accountData) return false;

    const collectionTime = new Date(accountData.collectionMetadata.collectionTime).getTime();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    
    return (Date.now() - collectionTime) < maxAge;
  }

  /**
   * Clear all cache data
   */
  static clear(): void {
    if (!this.isBrowser()) return;

    try {
      sessionStorage.removeItem(this.CACHE_KEY);
      sessionStorage.removeItem(this.CACHE_EXPIRY_KEY);
      console.log('[MaxCache] Cache cleared successfully');
    } catch (error) {
      console.error('[MaxCache] Failed to clear cache:', error);
    }
  }

  /**
   * Check if cache is valid
   */
  static isValid(): boolean {
    if (!this.isBrowser()) return false;

    try {
      const expiry = sessionStorage.getItem(this.CACHE_EXPIRY_KEY);
      return expiry ? Date.now() <= parseInt(expiry) : false;
    } catch (error) {
      return false;
    }
  }
}

export default MaximizedTwitterCache;