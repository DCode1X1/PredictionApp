"use client";
import React from "react";
import MultiPairChart from "./MultiPairChart";

export default function TradingApp() {
  return (
    <div className="w-full h-full bg-gray-950 text-white overflow-y-auto p-4">
      <MultiPairChart />
    </div>
  );
}
