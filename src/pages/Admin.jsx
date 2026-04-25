import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Admin() {
  const hotButtons = [
    { label: "AP", color: "bg-accent", path: "/ap" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground tracking-wider uppercase font-barlow">Admin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Administrative tools and controls</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {hotButtons.map((btn) => (
          <Link key={btn.label} to={btn.path}>
            <Button className={`${btn.color} text-white font-semibold`}>
              {btn.label}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}