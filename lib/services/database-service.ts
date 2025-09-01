import { createClient } from '@/lib/supabase/server';

export interface TwitterUser {
  twitter_id: string;
  username: string;
  display_name?: string;
  description?: string;
  profile_image_url?: string;
  followers_count?: number;
  following_count?: number;
  tweet_count?: number;
  listed_count?: number;
  verified?: boolean;
  account_created_at?: string;
  location?: string;
  website_url?: string;
}

export interface Tweet {
  tweet_id: string;
  twitter_user_id: string;
  text: string;
  created_at: string;
  like_count?: number;
  retweet_count?: number;
  reply_count?: number;
  quote_count?: number;
  engagement_score?: number;
  has_media?: boolean;
  media_data?: any;
  entities?: any;
  context_annotations?: any;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  possibly_sensitive?: boolean;
  source?: string;
  lang?: string;
  referenced_tweets?: any;
  tweet_url?: string;
}

export interface CollectionSession {
  user_id: string;
  twitter_user_id: string;
  username: string;
  total_tweets_collected?: number;
  pages_processed?: number;
  api_calls_used?: number;
  collection_status?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  time_span_days?: number;
  oldest_tweet_date?: string;
  newest_tweet_date?: string;
  metadata?: any;
}

export class DatabaseService {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * 插入或更新推特用户信息
   */
  async upsertTwitterUser(userData: TwitterUser) {
    try {
      const { data, error } = await this.supabase
        .from('twitter_users')
        .upsert(
          {
            twitter_id: userData.twitter_id,
            username: userData.username.toLowerCase(), // 统一小写
            display_name: userData.display_name,
            description: userData.description,
            profile_image_url: userData.profile_image_url,
            followers_count: userData.followers_count || 0,
            following_count: userData.following_count || 0,
            tweet_count: userData.tweet_count || 0,
            listed_count: userData.listed_count || 0,
            verified: userData.verified || false,
            account_created_at: userData.account_created_at,
            location: userData.location,
            website_url: userData.website_url,
            updated_at: new Date().toISOString()
          },
          { 
            onConflict: 'username',
            ignoreDuplicates: false
          }
        )
        .select()
        .single();

      if (error) {
        console.error('Error upserting twitter user:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Database error in upsertTwitterUser:', error);
      throw error;
    }
  }

  /**
   * 批量插入推文（忽略重复）
   */
  async insertTweets(tweets: Tweet[]) {
    if (tweets.length === 0) return [];

    try {
      const { data, error } = await this.supabase
        .from('tweets')
        .upsert(
          tweets.map(tweet => ({
            tweet_id: tweet.tweet_id,
            twitter_user_id: tweet.twitter_user_id,
            text: tweet.text,
            created_at: tweet.created_at,
            like_count: tweet.like_count || 0,
            retweet_count: tweet.retweet_count || 0,
            reply_count: tweet.reply_count || 0,
            quote_count: tweet.quote_count || 0,
            engagement_score: (tweet.like_count || 0) + (tweet.retweet_count || 0) + (tweet.reply_count || 0),
            has_media: tweet.has_media || false,
            media_data: tweet.media_data,
            entities: tweet.entities,
            context_annotations: tweet.context_annotations,
            conversation_id: tweet.conversation_id,
            in_reply_to_user_id: tweet.in_reply_to_user_id,
            possibly_sensitive: tweet.possibly_sensitive || false,
            source: tweet.source,
            lang: tweet.lang,
            referenced_tweets: tweet.referenced_tweets,
            tweet_url: tweet.tweet_url,
            collected_at: new Date().toISOString()
          })),
          { 
            onConflict: 'tweet_id',
            ignoreDuplicates: true
          }
        )
        .select();

      if (error) {
        console.error('Error inserting tweets:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Database error in insertTweets:', error);
      throw error;
    }
  }

  /**
   * 创建收集会话记录
   */
  async createCollectionSession(sessionData: CollectionSession) {
    try {
      const { data, error } = await this.supabase
        .from('collection_sessions')
        .insert({
          user_id: sessionData.user_id,
          twitter_user_id: sessionData.twitter_user_id,
          username: sessionData.username.toLowerCase(),
          total_tweets_collected: sessionData.total_tweets_collected || 0,
          pages_processed: sessionData.pages_processed || 0,
          api_calls_used: sessionData.api_calls_used || 0,
          collection_status: sessionData.collection_status || 'in_progress',
          error_message: sessionData.error_message,
          started_at: sessionData.started_at || new Date().toISOString(),
          completed_at: sessionData.completed_at,
          time_span_days: sessionData.time_span_days || 0,
          oldest_tweet_date: sessionData.oldest_tweet_date,
          newest_tweet_date: sessionData.newest_tweet_date,
          metadata: sessionData.metadata
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating collection session:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Database error in createCollectionSession:', error);
      throw error;
    }
  }

  /**
   * 更新收集会话状态
   */
  async updateCollectionSession(sessionId: string, updates: Partial<CollectionSession>) {
    try {
      const { data, error } = await this.supabase
        .from('collection_sessions')
        .update({
          ...updates,
          completed_at: updates.collection_status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating collection session:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Database error in updateCollectionSession:', error);
      throw error;
    }
  }

  /**
   * 获取用户的推文数据
   */
  async getUserTweets(username: string, limit?: number) {
    try {
      const normalizedUsername = username.toLowerCase().replace(/^@/, '');
      
      let query = this.supabase
        .from('tweets_with_user')
        .select('*')
        .eq('username', normalizedUsername)
        .order('created_at', { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching user tweets:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Database error in getUserTweets:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(username: string) {
    try {
      const normalizedUsername = username.toLowerCase().replace(/^@/, '');
      
      const { data, error } = await this.supabase
        .from('user_stats')
        .select('*')
        .eq('username', normalizedUsername)
        .single();

      if (error) {
        console.error('Error fetching user stats:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Database error in getUserStats:', error);
      throw error;
    }
  }

  /**
   * 获取含媒体的推文
   */
  async getMediaTweets(username: string) {
    try {
      const normalizedUsername = username.toLowerCase().replace(/^@/, '');
      
      const { data, error } = await this.supabase
        .from('tweets_with_user')
        .select('*')
        .eq('username', normalizedUsername)
        .eq('has_media', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching media tweets:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Database error in getMediaTweets:', error);
      throw error;
    }
  }

  /**
   * 获取顶级推文（按参与度排序）
   */
  async getTopTweets(username: string, limit: number = 10) {
    try {
      const normalizedUsername = username.toLowerCase().replace(/^@/, '');
      
      const { data, error } = await this.supabase
        .from('tweets_with_user')
        .select('*')
        .eq('username', normalizedUsername)
        .order('engagement_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching top tweets:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Database error in getTopTweets:', error);
      throw error;
    }
  }

  /**
   * 检查用户是否已存在数据
   */
  async checkUserExists(username: string) {
    try {
      const normalizedUsername = username.toLowerCase().replace(/^@/, '');
      
      const { data, error } = await this.supabase
        .from('twitter_users')
        .select('id, username, collected_tweets_count')
        .eq('username', normalizedUsername)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking user exists:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Database error in checkUserExists:', error);
      return null;
    }
  }

  /**
   * 记录搜索历史
   */
  async recordSearchHistory(userId: string, username: string, searchType: string, resultsCount: number, params?: any) {
    try {
      const { error } = await this.supabase
        .from('search_history')
        .insert({
          user_id: userId,
          username_searched: username.toLowerCase().replace(/^@/, ''),
          search_type: searchType,
          results_count: resultsCount,
          search_params: params
        });

      if (error) {
        console.error('Error recording search history:', error);
      }
    } catch (error) {
      console.error('Database error in recordSearchHistory:', error);
    }
  }
}