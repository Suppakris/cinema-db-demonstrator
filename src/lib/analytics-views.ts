export const analyticsViews = {
  bookings: {
    label: "Booking Statistics",
    description: "Daily confirmed bookings, seats, and sales revenue.",
    query: "SELECT Booking_Date, Total_Booking_Orders, Total_Seats_Booked, Total_Sales_Revenue\nFROM view_booking_statistics\nORDER BY Booking_Date ASC\nLIMIT 100;",
  },
  memberships: {
    label: "Membership Usage",
    description: "Ticket claims and revenue grouped by membership tier.",
    query: "SELECT Tier_Name, Tier_Type, Total_Active_Cards, Total_Tickets_Claimed, Total_Revenue_Generated\nFROM view_membership_usage_statistics\nORDER BY Total_Revenue_Generated DESC\nLIMIT 100;",
  },
  theaters: {
    label: "Top Theater Types",
    description: "Compare ticket sales and revenue across theater types.",
    query: "SELECT Theater_Type_Name, Total_Tickets_Sold, Total_Revenue\nFROM view_top_theater_types\nORDER BY Total_Tickets_Sold DESC\nLIMIT 100;",
  },
  movies: {
    label: "Monthly Movie Ranking",
    description: "Monthly movie popularity ranked by tickets sold.",
    query: "SELECT Month_Year, Movie_Title, Total_Tickets_Sold, Total_Revenue, Monthly_Popularity_Rank\nFROM view_monthly_movie_ranking\nWHERE Movie_Title NOT LIKE 'Demo Movie %'\nORDER BY Month_Year DESC, Monthly_Popularity_Rank ASC\nLIMIT 500;",
  },
  reviews: {
    label: "Movie Review Summary",
    description: "Average scores out of 100, with source and normalized review counts.",
    query: "SELECT m.Title AS Movie_Title, v.Source_Count, v.Normalized_Source_Count, v.Average_Score_100\nFROM v_movie_review_summary AS v\nJOIN movie AS m ON m.Movie_ID = v.Movie_ID\nWHERE v.Normalized_Source_Count > 0 AND m.Title NOT LIKE 'Demo Movie %'\nORDER BY v.Average_Score_100 DESC, v.Normalized_Source_Count DESC, m.Title\nLIMIT 100;",
  },
} as const;

export type AnalyticsViewId = keyof typeof analyticsViews;
