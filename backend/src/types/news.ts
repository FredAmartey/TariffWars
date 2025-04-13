export interface NewsEntry {
  id: string;
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
  imageUrl?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  date: string;
  url: string;
  summary: string;
}
