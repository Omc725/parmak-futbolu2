import React from 'react';
import { LeagueTableRow, Team } from '../types';

interface LeagueTableProps {
  table: LeagueTableRow[];
  playerTeam: Team;
}

const LeagueTable: React.FC<LeagueTableProps> = ({ table, playerTeam }) => {
  return (
    <div className="w-full max-w-4xl bg-slate-800/80 rounded-xl shadow-2xl overflow-x-auto border border-slate-700">
      <table className="w-full text-white min-w-[600px] md:min-w-full">
        <thead className="bg-slate-900/70">
          <tr>
            <th className="p-2 md:p-3 text-left font-semibold">#</th>
            <th className="p-2 md:p-3 text-left font-semibold">Takım</th>
            <th className="p-2 md:p-3 text-center font-semibold" title="Oynanan Maç">O</th>
            <th className="hidden md:table-cell p-3 text-center font-semibold" title="Galibiyet">G</th>
            <th className="hidden md:table-cell p-3 text-center font-semibold" title="Beraberlik">B</th>
            <th className="hidden md:table-cell p-3 text-center font-semibold" title="Mağlubiyet">M</th>
            <th className="p-2 md:p-3 text-center font-semibold" title="Averaj">AV</th>
            <th className="p-2 md:p-3 text-center font-semibold" title="Puan">Puan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {table.map((row, index) => (
            <tr key={row.team.abbr} className={`transition-colors duration-200 ${row.team.abbr === playerTeam.abbr ? 'bg-blue-600/30' : 'hover:bg-slate-700/50'}`}>
              <td className="p-2 md:p-3 text-center w-12">{index + 1}</td>
              <td className="p-2 md:p-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex-shrink-0 border-2 border-slate-500/50" style={{ background: `linear-gradient(to right, ${row.team.color1} 50%, ${row.team.color2} 50%)` }}></div>
                <span className="font-bold text-sm md:text-base">{row.team.abbr}</span>
              </td>
              <td className="p-2 md:p-3 text-center font-semibold">{row.played}</td>
              <td className="hidden md:table-cell p-3 text-center">{row.won}</td>
              <td className="hidden md:table-cell p-3 text-center">{row.drawn}</td>
              <td className="hidden md:table-cell p-3 text-center">{row.lost}</td>
              <td className="p-2 md:p-3 text-center">{row.goalDifference}</td>
              <td className="p-2 md:p-3 text-center font-extrabold text-base md:text-lg">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeagueTable;