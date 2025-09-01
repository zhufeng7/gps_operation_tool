import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TweetStyle {
  tone: string;
  keywords: string[];
  avgLength: number;
  commonPatterns: string[];
  emojiUsage: boolean;
  hashtagStyle: string;
}

interface RewriteRequest {
  originalTweet: string;
  targetTone: string;
  username?: string;
  style?: TweetStyle;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: RewriteRequest = await request.json();
    const { originalTweet, targetTone, username, style } = body;

    if (!originalTweet || typeof originalTweet !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Original tweet content is required' },
        { status: 400 }
      );
    }

    // 移除280字符限制，允许更长的内容进行重写

    console.log(`[Tweet Rewriter API] Rewriting tweet with tone: ${targetTone}`);

    // Generate rewritten tweet using AI
    const rewriteResult = await rewriteTweetWithAI({
      originalTweet,
      targetTone,
      username,
      style
    });

    // Log the rewrite activity
    const { error: historyError } = await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        search_type: 'tweet_rewrite',
        search_params: { 
          originalTweet: originalTweet.substring(0, 100), // Store first 100 chars for privacy
          targetTone,
          username: username || null
        },
        results_count: 1,
        metadata: {
          original_length: originalTweet.length,
          rewritten_length: rewriteResult.rewrittenTweet.length,
          confidence: rewriteResult.confidence,
          applied_tone: rewriteResult.appliedTone
        }
      });

    if (historyError) {
      console.warn('Failed to log rewrite history:', historyError);
    }

    console.log(`[Tweet Rewriter] Successfully rewritten tweet`);

    return NextResponse.json({
      success: true,
      ...rewriteResult,
      metadata: {
        original_length: originalTweet.length,
        rewritten_length: rewriteResult.rewrittenTweet.length,
        rewrite_time: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Tweet rewriter API error:', error);
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'AI服务配置错误，请联系管理员';
        statusCode = 500;
      } else if (error.message.includes('Rate limit')) {
        errorMessage = 'AI服务调用频率限制，请稍后重试';
        statusCode = 429;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI服务响应超时，请重试';
        statusCode = 504;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: statusCode }
    );
  }
}

async function rewriteTweetWithAI(params: RewriteRequest): Promise<{
  rewrittenTweet: string;
  appliedTone: string;
  confidence: number;
  improvements: string[];
}> {
  const { originalTweet, targetTone, username, style } = params;

  // Build the AI prompt based on the target tone and style
  // Note: These prompts would be used for actual AI service integration
  // const systemPrompt = buildSystemPrompt(targetTone, username, style);
  // const userPrompt = `请重写以下推文：\n\n"${originalTweet}"\n\n要求：保持核心信息不变，优化表达方式和吸引力。`;

  try {
    // Here you would typically call an AI service like OpenAI, Claude, or DeepSeek
    // For now, we'll use a rule-based approach with some AI-like intelligence
    
    const rewriteResult = await simulateAIRewrite(originalTweet, targetTone, style);
    
    return {
      rewrittenTweet: rewriteResult.text,
      appliedTone: targetTone,
      confidence: rewriteResult.confidence,
      improvements: rewriteResult.improvements
    };
    
  } catch (error) {
    // Fallback to rule-based rewriting if AI service fails
    console.warn('AI service failed, using fallback rewriter:', error);
    return fallbackRewrite(originalTweet, targetTone, style);
  }
}

function buildSystemPrompt(tone: string, username?: string, style?: TweetStyle): string {
  let prompt = "你是一个专业的社交媒体内容优化专家，专门帮助用户重写和优化推文内容。";

  if (username && style) {
    prompt += `\n\n请模仿 @${username} 的写作风格：
- 语调：${style.tone}
- 常用关键词：${style.keywords.join(', ')}
- 平均长度：${style.avgLength} 字符
- 表情符号使用：${style.emojiUsage ? '经常使用' : '较少使用'}
- 标签风格：${style.hashtagStyle}
- 写作模式：${style.commonPatterns.join(', ')}`;
  }

  const toneGuides: { [key: string]: string } = {
    professional: "保持专业、权威的语调，使用正式的商务用语",
    casual: "使用轻松、友好的语调，如同朋友间的对话",
    humorous: "添加幽默元素，使用有趣的表达方式",
    technical: "使用精确的技术术语，保持专业性",
    inspirational: "使用积极、鼓舞人心的语言，激励读者",
    auto: username ? `模仿 @${username} 的个人写作风格` : "保持原有语调"
  };

  prompt += `\n\n目标语调：${toneGuides[tone] || toneGuides.auto}`;

  prompt += `\n\n重写要求：
1. 保持核心信息和事实不变
2. 优化表达方式，提高吸引力
3. 保持内容自然流畅，长度适中
4. 保持推文的自然流畅性
5. 如果原文有链接、@用户名或#标签，请保留`;

  return prompt;
}

async function simulateAIRewrite(originalTweet: string, tone: string, style?: TweetStyle): Promise<{
  text: string;
  confidence: number;
  improvements: string[];
}> {
  // Advanced rewrite engine that ensures meaningful differences while preserving style
  const improvements: string[] = [];
  let confidence = 75;
  
  // Step 1: Analyze original tweet structure
  const analysis = analyzeOriginalTweet(originalTweet);
  
  // Step 2: Generate multiple rewrite variations
  const variations = await generateVariations(originalTweet, tone, style, analysis);
  
  // Step 3: Select the best variation that's sufficiently different
  const selectedVariation = selectBestVariation(variations, originalTweet, style);
  
  // Step 4: Apply final polish and validation
  let rewritten = selectedVariation.text;
  
  // Ensure meaningful differences
  const similarity = calculateSimilarity(originalTweet, rewritten);
  if (similarity > 0.8) {
    // Too similar, apply stronger transformations
    rewritten = await applyStrongerRewrite(rewritten, originalTweet, tone, style);
    improvements.push('深度重构');
  }
  
  // Apply style-specific enhancements
  if (style) {
    rewritten = await applyAdvancedStyleTransformations(rewritten, style, originalTweet);
    improvements.push('风格深度匹配');
    confidence += 15;
  }
  
  // Apply tone-specific transformations with more sophistication
  rewritten = await applyAdvancedToneTransformations(rewritten, tone, originalTweet);
  improvements.push(`${tone}化重写`);
  
  // Final optimization
  rewritten = await optimizeForEngagement(rewritten, originalTweet, tone);
  rewritten = ensureProperLength(rewritten);
  
  // Calculate final confidence based on quality metrics
  confidence = calculateRewriteConfidence(originalTweet, rewritten, tone, style, improvements);
  
  if (rewritten !== originalTweet) {
    improvements.push('表达转换');
  }
  
  return {
    text: rewritten,
    confidence: Math.min(95, confidence),
    improvements: [...new Set(improvements)] // Remove duplicates
  };
}

function applyProfessionalTone(text: string): string {
  // Replace casual words with professional equivalents
  const replacements: { [key: string]: string } = {
    'awesome': 'excellent',
    'cool': 'impressive',
    'great': 'outstanding',
    'nice': 'commendable',
    'good': 'valuable',
    'bad': 'concerning',
    'huge': 'significant',
    'tons of': 'numerous',
    'a lot of': 'substantial',
    'really': 'particularly',
    'super': 'highly',
    'pretty': 'quite'
  };

  let result = text;
  Object.entries(replacements).forEach(([casual, professional]) => {
    const regex = new RegExp(`\\b${casual}\\b`, 'gi');
    result = result.replace(regex, professional);
  });

  // Remove excessive exclamation marks
  result = result.replace(/!+/g, '.');
  
  return result;
}

function applyCasualTone(text: string): string {
  // Add casual connectors and soften formal language
  let result = text;

  // Replace formal words with casual equivalents
  const replacements: { [key: string]: string } = {
    'utilize': 'use',
    'therefore': 'so',
    'furthermore': 'also',
    'consequently': 'so',
    'substantial': 'big',
    'significant': 'important',
    'concerning': 'worrying'
  };

  Object.entries(replacements).forEach(([formal, casual]) => {
    const regex = new RegExp(`\\b${formal}\\b`, 'gi');
    result = result.replace(regex, casual);
  });

  // Add casual phrases occasionally
  if (Math.random() > 0.7) {
    const casualPhrases = ['BTW,', 'Just saying,', 'IMO,'];
    const randomPhrase = casualPhrases[Math.floor(Math.random() * casualPhrases.length)];
    result = `${randomPhrase} ${result}`;
  }

  return result;
}

function applyHumorousTone(text: string): string {
  let result = text;

  // Add humor through wordplay and emojis
  const humorousReplacements: { [key: string]: string } = {
    'problem': 'plot twist',
    'issue': 'adventure',
    'challenge': 'boss level',
    'difficult': 'spicy',
    'easy': 'piece of cake 🍰',
    'working': 'grinding',
    'thinking': 'brain-storming 🧠'
  };

  Object.entries(humorousReplacements).forEach(([serious, funny]) => {
    const regex = new RegExp(`\\b${serious}\\b`, 'gi');
    if (Math.random() > 0.6) { // Apply randomly for authenticity
      result = result.replace(regex, funny);
    }
  });

  // Add appropriate emojis
  if (!result.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]/gu)) {
    const emojis = ['😄', '😊', '🤔', '💭', '🔥', '💯'];
    result += ' ' + emojis[Math.floor(Math.random() * emojis.length)];
  }

  return result;
}

function applyTechnicalTone(text: string): string {
  let result = text;

  // Add technical precision
  const technicalReplacements: { [key: string]: string } = {
    'better': 'optimized',
    'faster': 'more efficient',
    'good': 'robust',
    'bad': 'suboptimal',
    'big': 'scalable',
    'small': 'lightweight',
    'new': 'innovative',
    'old': 'legacy'
  };

  Object.entries(technicalReplacements).forEach(([casual, technical]) => {
    const regex = new RegExp(`\\b${casual}\\b`, 'gi');
    result = result.replace(regex, technical);
  });

  return result;
}

function applyInspirationalTone(text: string): string {
  let result = text;

  // Add motivational elements
  const inspirationalWords = ['achieve', 'build', 'create', 'dream', 'grow', 'inspire', 'transform'];
  const motivationalPrefixes = ['Let\'s', 'Together we can', 'The future is'];

  // Add inspirational call-to-action
  if (Math.random() > 0.5 && !result.includes('!')) {
    result += '! 🌟';
  }

  // Replace negative words with positive ones
  const positiveReplacements: { [key: string]: string } = {
    'problem': 'opportunity',
    'failure': 'learning experience',
    'difficult': 'challenging but rewarding',
    'impossible': 'challenging',
    'can\'t': 'will learn to'
  };

  Object.entries(positiveReplacements).forEach(([negative, positive]) => {
    const regex = new RegExp(`\\b${negative}\\b`, 'gi');
    result = result.replace(regex, positive);
  });

  return result;
}

function applyStyleTransformations(text: string, style: TweetStyle): string {
  let result = text;

  // Apply emoji usage pattern
  if (style.emojiUsage && !text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]/gu)) {
    const contextEmojis = ['💡', '🚀', '🔥', '💯', '⚡', '🌟', '🎯', '📈'];
    result += ' ' + contextEmojis[Math.floor(Math.random() * contextEmojis.length)];
  }

  // Apply hashtag style
  if (style.hashtagStyle === 'heavy' && !text.includes('#')) {
    result += ' #innovation #growth';
  } else if (style.hashtagStyle === 'moderate' && Math.random() > 0.5 && !text.includes('#')) {
    result += ' #insight';
  }

  // Apply keyword integration
  if (style.keywords.length > 0) {
    const keyword = style.keywords[Math.floor(Math.random() * Math.min(3, style.keywords.length))];
    // Only add if not already present and if it makes sense contextually
    if (!result.toLowerCase().includes(keyword.toLowerCase()) && Math.random() > 0.6) {
      result = result.replace(/\.$/, ` with ${keyword}.`);
    }
  }

  return result;
}

function improveEngagement(text: string): string {
  let result = text;

  // Add engagement hooks
  const hooks = [
    'Here\'s the thing:',
    'Plot twist:',
    'Real talk:',
    'Fun fact:',
    'Key insight:'
  ];

  // Add question for engagement
  if (Math.random() > 0.8 && !text.includes('?')) {
    result += ' What do you think?';
  }

  return result;
}

function optimizeLength(text: string): string {
  // If text is too short, try to expand meaningfully
  if (text.length < 50) {
    // Add context or call-to-action
    const expansions = [
      ' Thoughts?',
      ' What\'s your take?',
      ' Worth considering.',
      ' Food for thought.',
      ' Just my 2¢.'
    ];
    return text + expansions[Math.floor(Math.random() * expansions.length)];
  }

  // If too long, optimize for conciseness (raised limit to allow longer content)
  if (text.length > 500) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/very\s+/gi, '')
      .replace(/really\s+/gi, '')
      .replace(/quite\s+/gi, '')
      .trim();
  }

  return text;
}

// Advanced rewrite helper functions
function analyzeOriginalTweet(text: string) {
  return {
    length: text.length,
    hasQuestion: text.includes('?'),
    hasExclamation: text.includes('!'),
    hasHashtags: /#\w+/.test(text),
    hasMentions: /@\w+/.test(text),
    hasLinks: /https?:\/\//.test(text),
    hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]/gu.test(text),
    words: text.split(/\s+/).filter(w => w.length > 0),
    sentences: text.split(/[.!?]+/).filter(s => s.trim().length > 0),
    sentiment: determineSentiment(text),
    complexity: calculateComplexity(text)
  };
}

function determineSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const positiveWords = ['good', 'great', 'awesome', 'amazing', 'excellent', 'love', 'like', 'happy', 'excited', 'wonderful', 'fantastic'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'disappointed', 'frustrated', 'worried'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.reduce((count, word) => count + (lowerText.includes(word) ? 1 : 0), 0);
  const negativeCount = negativeWords.reduce((count, word) => count + (lowerText.includes(word) ? 1 : 0), 0);
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function calculateComplexity(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgWordsPerSentence = text.split(/\s+/).length / Math.max(sentences.length, 1);
  const longWords = text.split(/\s+/).filter(w => w.length > 6).length;
  const totalWords = text.split(/\s+/).length;
  
  return (avgWordsPerSentence / 10) + (longWords / totalWords);
}

async function generateVariations(originalTweet: string, tone: string, style?: TweetStyle, analysis?: any) {
  const variations = [];
  
  // Variation 1: Structure-preserving rewrite
  variations.push({
    text: await structurePreservingRewrite(originalTweet, tone, style),
    type: 'structure-preserving',
    score: 0.7
  });
  
  // Variation 2: Perspective shift
  variations.push({
    text: await perspectiveShiftRewrite(originalTweet, tone, style),
    type: 'perspective-shift', 
    score: 0.8
  });
  
  // Variation 3: Elaborative rewrite
  variations.push({
    text: await elaborativeRewrite(originalTweet, tone, style),
    type: 'elaborative',
    score: 0.6
  });
  
  return variations;
}

async function structurePreservingRewrite(text: string, tone: string, style?: TweetStyle): Promise<string> {
  let rewritten = text;
  
  // Advanced synonym replacement
  const synonymMap: { [key: string]: string[] } = {
    'good': ['excellent', 'outstanding', 'impressive', 'solid', 'strong'],
    'bad': ['concerning', 'problematic', 'suboptimal', 'challenging'],
    'big': ['significant', 'substantial', 'major', 'considerable'],
    'new': ['latest', 'recent', 'fresh', 'innovative', 'cutting-edge'],
    'fast': ['rapid', 'swift', 'accelerated', 'efficient', 'streamlined']
  };
  
  Object.entries(synonymMap).forEach(([original, synonyms]) => {
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    if (regex.test(rewritten) && Math.random() > 0.4) {
      const synonym = synonyms[Math.floor(Math.random() * synonyms.length)];
      rewritten = rewritten.replace(regex, synonym);
    }
  });
  
  return rewritten;
}

async function perspectiveShiftRewrite(text: string, tone: string, style?: TweetStyle): Promise<string> {
  let rewritten = text;
  
  // Add perspective modifiers
  const perspectiveModifiers = [
    'Consider this:',
    'Here\'s the thing:',
    'Think about it:',
    'The reality is:',
    'Worth noting:'
  ];
  
  if (Math.random() > 0.6 && text.length < 220) {
    const modifier = perspectiveModifiers[Math.floor(Math.random() * perspectiveModifiers.length)];
    rewritten = `${modifier} ${rewritten.toLowerCase()}`;
  }
  
  return rewritten;
}

async function elaborativeRewrite(text: string, tone: string, style?: TweetStyle): Promise<string> {
  let rewritten = text;
  
  if (text.length < 200) {
    const elaborativeAdditions = [
      'Worth considering',
      'Key insight',
      'Important detail',
      'Food for thought',
      'Just my take'
    ];
    
    const addition = elaborativeAdditions[Math.floor(Math.random() * elaborativeAdditions.length)];
    rewritten = `${rewritten.replace(/\.$/, '')} - ${addition}.`;
  }
  
  return rewritten;
}

function selectBestVariation(variations: any[], originalTweet: string, style?: TweetStyle) {
  const scoredVariations = variations.map(variation => {
    const similarity = calculateSimilarity(originalTweet, variation.text);
    const differenceScore = 1 - similarity;
    const qualityScore = calculateQualityScore(variation.text);
    
    return {
      ...variation,
      finalScore: (differenceScore * 0.6 + qualityScore * 0.4) * variation.score
    };
  });
  
  return scoredVariations.reduce((best, current) => 
    current.finalScore > best.finalScore ? current : best
  );
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function calculateQualityScore(text: string): number {
  let score = 0.5;
  
  const length = text.length;
  if (length > 50 && length < 250) score += 0.2;
  
  const words = text.split(/\s+/).length;
  if (words > 5 && words < 40) score += 0.2;
  
  if (text.includes('!') || text.includes('?')) score += 0.1;
  
  return Math.min(1, score);
}

async function applyStrongerRewrite(text: string, originalTweet: string, tone: string, style?: TweetStyle): Promise<string> {
  let rewritten = text;
  
  // Apply multiple transformation layers
  rewritten = await restructureSentence(rewritten);
  rewritten = await applyAdvancedToneTransformations(rewritten, tone, originalTweet);
  
  return rewritten;
}

async function restructureSentence(text: string): Promise<string> {
  if (text.includes(',')) {
    const parts = text.split(',').map(p => p.trim());
    if (parts.length > 1) {
      return parts.reverse().join('. ').replace(/\.\s*\./, '.');
    }
  }
  
  return text;
}

async function applyAdvancedStyleTransformations(text: string, style: TweetStyle, originalTweet: string): Promise<string> {
  let rewritten = text;
  
  // Apply emoji pattern if the style uses emojis frequently
  if (style.emojiUsage && !text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]/gu)) {
    const contextEmojis = ['💡', '🚀', '🔥', '💯', '⚡', '🌟', '🎯', '📈', '✨', '🤔'];
    const emoji = contextEmojis[Math.floor(Math.random() * contextEmojis.length)];
    rewritten += ` ${emoji}`;
  }
  
  // Apply hashtag style
  if (style.hashtagStyle === 'heavy' && !text.includes('#')) {
    rewritten += ' #insight #growth';
  } else if (style.hashtagStyle === 'moderate' && Math.random() > 0.5 && !text.includes('#')) {
    rewritten += ' #thoughtful';
  }
  
  return rewritten;
}

async function applyAdvancedToneTransformations(text: string, tone: string, originalTweet: string): Promise<string> {
  let rewritten = text;
  
  switch (tone) {
    case 'professional':
      const professionalReplacements: { [key: string]: string } = {
        'awesome': 'exceptional',
        'cool': 'innovative',
        'great': 'outstanding', 
        'good': 'effective',
        'really': 'particularly'
      };
      
      Object.entries(professionalReplacements).forEach(([casual, professional]) => {
        const regex = new RegExp(`\\b${casual}\\b`, 'gi');
        rewritten = rewritten.replace(regex, professional);
      });
      break;
      
    case 'casual':
      const casualMarkers = ['Honestly,', 'Real talk,', 'Just saying,', 'I mean,'];
      if (Math.random() > 0.6 && rewritten.length < 200) {
        const marker = casualMarkers[Math.floor(Math.random() * casualMarkers.length)];
        rewritten = `${marker} ${rewritten.toLowerCase()}`;
      }
      break;
      
    case 'humorous':
      const humorousReplacements: { [key: string]: string } = {
        'problem': 'plot twist 🤔',
        'difficult': 'spicy challenge',
        'working': 'grinding away'
      };
      
      Object.entries(humorousReplacements).forEach(([serious, funny]) => {
        const regex = new RegExp(`\\b${serious}\\b`, 'gi');
        if (Math.random() > 0.5) {
          rewritten = rewritten.replace(regex, funny);
        }
      });
      break;
      
    case 'inspirational':
      const positiveReplacements: { [key: string]: string } = {
        'problem': 'opportunity',
        'difficult': 'growth-worthy'
      };
      
      Object.entries(positiveReplacements).forEach(([negative, positive]) => {
        const regex = new RegExp(`\\b${negative}\\b`, 'gi');
        rewritten = rewritten.replace(regex, positive);
      });
      
      if (!rewritten.includes('!') && !rewritten.includes('✨')) {
        rewritten += ' ✨';
      }
      break;
  }
  
  return rewritten;
}

async function optimizeForEngagement(text: string, originalTweet: string, tone: string): Promise<string> {
  let result = text;
  
  // Add engagement hooks based on tone
  if (tone === 'casual' && Math.random() > 0.7 && !result.includes('?')) {
    result += ' What do you think?';
  } else if (tone === 'professional' && Math.random() > 0.8) {
    result += ' Thoughts?';
  }
  
  return result;
}

function ensureProperLength(text: string): string {
  // 移除280字符硬限制，只处理过短的内容
  if (text.length < 30 && !text.includes('?')) {
    const extenders = [' Worth noting.', ' Food for thought.', ' Just saying.'];
    return text + extenders[Math.floor(Math.random() * extenders.length)];
  }
  
  return text;
}

function calculateRewriteConfidence(originalTweet: string, rewritten: string, tone: string, style?: TweetStyle, improvements: string[]): number {
  let confidence = 70;
  
  // Similarity check (sweet spot is 30-70% similarity)
  const similarity = calculateSimilarity(originalTweet, rewritten);
  if (similarity >= 0.3 && similarity <= 0.7) {
    confidence += 15;
  } else if (similarity < 0.3) {
    confidence += 10;
  } else {
    confidence -= 10;
  }
  
  // Style matching
  if (style) {
    confidence += 10;
  }
  
  // Number of improvements applied
  confidence += improvements.length * 2;
  
  return Math.min(95, Math.max(60, confidence));
}

function fallbackRewrite(originalTweet: string, tone: string, style?: TweetStyle): {
  rewrittenTweet: string;
  appliedTone: string;
  confidence: number;
  improvements: string[];
} {
  // Simple fallback when AI service is unavailable
  let rewritten = originalTweet;
  
  // Basic improvements
  rewritten = rewritten.replace(/\s+/g, ' ').trim();
  
  // Add tone-appropriate ending
  switch (tone) {
    case 'professional':
      if (!rewritten.endsWith('.')) rewritten += '.';
      break;
    case 'casual':
      if (!rewritten.includes('!')) rewritten += '!';
      break;
    case 'humorous':
      rewritten += ' 😄';
      break;
    case 'inspirational':
      rewritten += ' ✨';
      break;
  }

  return {
    rewrittenTweet: rewritten,
    appliedTone: tone,
    confidence: 60, // Lower confidence for fallback
    improvements: ['基础优化']
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}