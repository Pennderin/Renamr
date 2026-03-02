// ═══════════════════════════════════════════════════════════════════
// Format Engine — Custom naming expression processor
// ═══════════════════════════════════════════════════════════════════

const FormatEngine = {
  /**
   * Apply a format string with variable substitution.
   * Format: {variable} gets replaced with the value.
   * Supports: {title}, {year}, {series}, {season}, {episode}, {author},
   *           {track}, {narrator}, {genre}, {rating}, {ext}
   *
   * Padding: {season:2} pads to 2 digits, {episode:2} pads to 2 digits
   */
  apply(format, data) {
    if (!format) return '';

    let result = format.replace(/\{(\w+)(?::(\d+))?\}/g, (match, key, padLen) => {
      let value = data[key];
      if (value === undefined || value === null || value === '') {
        return ''; // Replace with empty string for missing values
      }
      value = String(value);
      if (padLen) {
        value = value.padStart(parseInt(padLen), '0');
      }
      return sanitizeFilename(value);
    });

    // Clean up artifacts from empty variables
    result = result
      .replace(/\[\s*\]/g, '')         // Remove empty brackets []
      .replace(/\(\s*\)/g, '')         // Remove empty parens ()
      .replace(/\s*-\s*Book\s*-\s*/gi, ' - ')  // Remove orphaned "Book" from empty bookNum
      .replace(/\bBook\s*-\s*/gi, '')  // Remove "Book - " at start of segment when bookNum empty
      .replace(/\s*-\s*Book\s*$/gi, '') // Remove " - Book" at end when bookNum empty
      .replace(/\s*-\s*-\s*/g, ' - ') // Collapse double dashes
      .replace(/\s{2,}/g, ' ')        // Collapse multiple spaces
      .replace(/\s*[-·]\s*$/g, '')    // Remove trailing separators
      .replace(/\/\s+/g, '/')         // No space after /
      .replace(/\s+\//g, '/')         // No space before /
      .replace(/\/\//g, '/')          // No double slashes
      .replace(/\\\\/g, '\\')         // No double backslashes
      .trim();

    // Clean each path segment — remove segments that are effectively empty
    // (only whitespace, dashes, "Book", connectors after variables resolved to empty)
    result = result.split('/').map(s => {
      s = s.trim();
      // Remove leading/trailing dashes and connectors
      s = s.replace(/^[\s\-–]+|[\s\-–]+$/g, '').trim();
      return s;
    }).filter(s => {
      // Remove segments that are empty or just filler words like "Book" or "- Book -"
      if (!s) return false;
      const stripped = s.replace(/[-–:,.\s]/g, '').replace(/\b(Book|Vol|Volume|Part)\b/gi, '').trim();
      return stripped.length > 0;
    }).join('/');

    return result;
  },

  /**
   * Generate a full output path based on format, data, and file extension.
   * The format can contain '/' for directory structure.
   */
  generatePath(format, data, ext, baseDir) {
    const formatted = this.apply(format, data);
    if (!formatted) return null;

    const fileName = formatted + ext;
    if (baseDir) {
      return joinPath(baseDir, fileName);
    }
    return fileName;
  },

  /**
   * Generate a preview string for the format editor.
   */
  async preview(format, type) {
    const sampleData = {
      movie: {
        title: 'The Shawshank Redemption',
        year: '1994',
        rating: '9.3',
        resolution: '1080p',
        source: 'BluRay',
        videoCodec: 'x265',
        audioCodec: 'DTS-HD MA',
        hdr: 'HDR10',
        edition: 'Remastered',
        group: 'FGT',
        channels: '5.1'
      },
      tv: {
        series: 'Breaking Bad',
        season: '2',
        episode: '9',
        title: '4 Days Out',
        year: '2009',
        resolution: '1080p',
        source: 'BluRay',
        videoCodec: 'x264',
        audioCodec: 'AC3',
        hdr: '',
        group: 'DEMAND',
        channels: '5.1'
      },
      audiobook: {
        author: 'Brandon Sanderson',
        title: 'Words of Radiance',
        series: 'The Stormlight Archive',
        bookNum: '2',
        year: '2014',
        chapter: '5',
        track: '5',
        chapterTitle: 'Bridge Four',
        narrator: 'Michael Kramer',
        genre: 'Fantasy'
      }
    };

    let result = this.apply(format, sampleData[type] || {});
    const typeMap = { movie: 'movie', tv: 'tv', audiobook: 'audiobook' };
    const prefix = typeMap[type] || 'movie';
    const articleFolder = await api.getStore(`${prefix}ArticleFolder`);
    const articleFile = await api.getStore(`${prefix}ArticleFile`);
    result = this.applyArticleSuffix(result, articleFolder, articleFile);
    return result;
  },

  /**
   * Move leading articles (The, A, An) to suffix.
   * "The Shawshank Redemption (1994)" → "Shawshank Redemption, The (1994)"
   * "A Beautiful Mind (2001)" → "Beautiful Mind, A (2001)"
   */
  moveArticleToSuffix(text) {
    if (!text) return text;
    const match = text.match(/^(The|A|An)\s+(.+)/i);
    if (!match) return text;
    const article = match[1];
    let rest = match[2];
    // Insert article before any trailing parenthetical/bracket
    const trailingMatch = rest.match(/^(.+?)\s*(\(.*\)|\[.*\])$/);
    if (trailingMatch) {
      return `${trailingMatch[1]}, ${article} ${trailingMatch[2]}`;
    }
    return `${rest}, ${article}`;
  },

  /**
   * Apply article suffix transformation to a formatted path.
   * Splits by '/', applies to folder segments and/or file segment based on options.
   */
  applyArticleSuffix(formatted, folderSuffix, fileSuffix) {
    if (!folderSuffix && !fileSuffix) return formatted;
    const parts = formatted.split('/');
    if (parts.length === 1) {
      // No folder, just a filename
      return fileSuffix ? this.moveArticleToSuffix(parts[0]) : parts[0];
    }
    // Multiple segments: all but last are folders, last is file
    return parts.map((part, i) => {
      const isFile = (i === parts.length - 1);
      if (isFile && fileSuffix) return this.moveArticleToSuffix(part);
      if (!isFile && folderSuffix) return this.moveArticleToSuffix(part);
      return part;
    }).join('/');
  },

  // Default format strings
  defaults: {
    movie: '{title} ({year})/{title} ({year})',
    tv: '{series}/Season {season}/{series} - S{season:2}E{episode:2} - {title}',
    audiobook: '{author}/{series}/{series} - Book {bookNum} - {title}/Chapter {chapter:2}'
  }
};
