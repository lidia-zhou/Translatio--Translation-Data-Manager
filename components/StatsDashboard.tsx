import React from 'react';
import { BibEntry } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface StatsDashboardProps {
  data: BibEntry[];
  insights: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const StatsDashboard: React.FC<StatsDashboardProps> = ({ data, insights }) => {
    
    // Process Data for Publication Years
    const yearCounts = data.reduce((acc, curr) => {
        acc[curr.publicationYear] = (acc[curr.publicationYear] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);
    
    const yearData = Object.keys(yearCounts).map(year => ({
        year: year,
        count: yearCounts[parseInt(year)]
    })).sort((a, b) => parseInt(a.year) - parseInt(b.year));

    // Process Data for Translator Gender
    const genderCounts = data.reduce((acc, curr) => {
        const g = curr.translator.gender || 'Unknown';
        acc[g] = (acc[g] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const genderData = Object.keys(genderCounts).map(g => ({
        name: g,
        value: genderCounts[g]
    }));

    // Process Source Languages
    const langCounts = data.reduce((acc, curr) => {
        const l = curr.sourceLanguage || 'Unknown';
        acc[l] = (acc[l] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const langData = Object.keys(langCounts).map(l => ({
        name: l,
        value: langCounts[l]
    }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
      
      {/* Temporal Distribution */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Temporal Distribution (Publication Year)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis allowDecimals={false} />
              <Tooltip cursor={{fill: '#f1f5f9'}} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Publications" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Translator Gender Stats */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Translator Demographics</h3>
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {genderData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Source Languages */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Source Languages</h3>
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={langData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} name="Count" />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

       {/* AI Insights Panel */}
       <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-100 col-span-1 md:col-span-2">
         <div className="flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-lg font-semibold text-indigo-900">AI Generated Insights</h3>
         </div>
         <div className="prose prose-sm max-w-none text-indigo-800">
             {insights ? (
                 <p className="whitespace-pre-line leading-relaxed">{insights}</p>
             ) : (
                 <p className="italic opacity-70">Generate data to see AI insights...</p>
             )}
         </div>
      </div>

    </div>
  );
};

export default StatsDashboard;
