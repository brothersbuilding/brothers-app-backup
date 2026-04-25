import React from "react";
import { Link } from "react-router-dom";
import { FileBarChart, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";

const REPORT_LINKS = [
  {
    key: "payroll",
    label: "Payroll Report",
    description: "View all employee time card data by pay period, employee, project, cost code, SAIF code, or custom dates.",
    icon: FileBarChart,
    path: "/reports/payroll",
  },
  {
    key: "saif",
    label: "SAIF Monthly Report",
    description: "Workers' comp classification summary grouped by employee and SAIF code. Filter by pay period and export to Excel.",
    icon: ShieldCheck,
    path: "/reports/saif",
  },
];

export default function Reports() {
  return (
    <div>
      <PageHeader title="Reports" subtitle="View and export operational reports" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_LINKS.map((report) => (
          <Link key={report.key} to={report.path}>
            <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group border-border hover:border-accent">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                  <report.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">{report.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{report.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}