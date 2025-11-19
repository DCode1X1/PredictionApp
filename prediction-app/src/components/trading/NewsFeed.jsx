import React, { useEffect, useState, useRef } from "react";

function NewsFeed() {
  const [news, setNews] = useState([]);
  const [error, setError] = useState(null);
  const [newArrivals, setNewArrivals] = useState(0);
  const lastFetchedIds = useRef(new Set());

  const fetchNews = async () => {
    try {
      const res = await fetch(
        "https://api.rss2json.com/v1/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml"
      );
      if (!res.ok) throw new Error("News fetch failed");
      const data = await res.json();
      const arr = data.items || [];
      setError(null);

      // detect new items
      const seen = lastFetchedIds.current;
      let newCount = 0;
      arr.forEach(item => {
        if (!seen.has(item.link)) newCount += 1;
      });
      if (newCount > 0) setNewArrivals(newCount);

      // update seen set
      lastFetchedIds.current = new Set(arr.map(i => i.link));
      setNews(arr);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, 60 * 1000); // poll every minute
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-6 bg-gray-800 rounded-xl text-white">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        BTC/USD News Feed
        {newArrivals > 0 && (
          <span className="bg-red-500 text-white px-2 rounded-full text-sm">
            {newArrivals} New
          </span>
        )}
      </h2>
      {error && <p className="text-red-400 mb-2">Error: {error}</p>}
      <ul className="space-y-4">
        {news.map((item, idx) => (
          <li key={idx} className="border-b border-gray-700 pb-2">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-blue-300"
            >
              {item.title}
            </a>
            <div className="text-gray-400 text-xs">
              {new Date(item.pubDate).toLocaleString()} — {item.author || "CoinDesk"}
            </div>
            {item.description && <p className="text-gray-300 text-sm mt-1">{item.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default NewsFeed;
