interface Author {
  name?: string;
  avatar?: string;
}

// API endpoint https://api.www.documentcloud.org/api/addons/
export interface AddOnListItem {
  id: number;
  name: string;
  repository: string;
  parameters: any;
  description?: string;
  author?: Author;
  usage?: number;
  categories: string[];
  documents: string[];
  active: boolean;
  featured: boolean;
  default: boolean;
  // TODO: Add `premium` flag and `premium_cost` to add-on data
  premium?: boolean;
  premium_cost?: {
    amount: number;
    unit: string;
  };
}
