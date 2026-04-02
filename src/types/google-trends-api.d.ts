declare module 'google-trends-api' {
  interface TrendsOptions {
    keyword?: string;
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
    trendDate?: Date;
  }

  function autoComplete(options: TrendsOptions): Promise<string>;
  function dailyTrends(options: TrendsOptions): Promise<string>;
  function interestByRegion(options: TrendsOptions): Promise<string>;
  function interestOverTime(options: TrendsOptions): Promise<string>;
  function realTimeTrends(options: TrendsOptions): Promise<string>;
  function relatedQueries(options: TrendsOptions): Promise<string>;
  function relatedTopics(options: TrendsOptions): Promise<string>;

  export {
    autoComplete,
    dailyTrends,
    interestByRegion,
    interestOverTime,
    realTimeTrends,
    relatedQueries,
    relatedTopics,
  };
}
