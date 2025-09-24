import React from 'react';
import { Tournament, Team as TeamType, TournamentNode } from '../types';

interface TournamentBracketProps {
  tournament: Tournament;
}

const TeamDisplay: React.FC<{team?: TeamType, score?: number, winner?: boolean}> = ({team, score, winner}) => (
    <div className={`flex items-center justify-between p-1 md:p-2 rounded w-32 md:w-44 h-10 md:h-12 transition-all duration-300 ${team ? 'bg-slate-700' : 'bg-slate-800/50'} ${winner ? 'border-2 border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-2 border-transparent'}`}>
        {team ? (
            <>
                <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                    <div className="w-6 h-6 md:w-7 md:h-7 rounded-full flex-shrink-0 border-2 border-slate-500/50" style={{ background: `linear-gradient(to right, ${team.color1} 50%, ${team.color2} 50%)` }}></div>
                    <span className="font-bold text-sm md:text-md truncate">{team.abbr}</span>
                </div>
                {score !== undefined && <span className="font-bold text-xl md:text-2xl">{score}</span>}
            </>
        ) : (
             <span className="text-slate-500 text-xs md:text-sm">Belirlenmedi</span>
        )}
    </div>
);

const Matchup: React.FC<{match: TournamentNode}> = ({ match }) => {
    const isFinished = match.result !== undefined;
    
    if (!isFinished) {
        return (
            <div className="flex flex-col gap-2">
                <TeamDisplay team={match.team1} />
                <TeamDisplay team={match.team2} />
            </div>
        );
    }

    const { result } = match;
    const hasPenalties = result!.team1Penalties !== undefined && result!.team2Penalties !== undefined;

    let winner1, winner2, score1, score2;

    if (hasPenalties) {
        winner1 = result!.team1Penalties! > result!.team2Penalties!;
        winner2 = result!.team2Penalties! > result!.team1Penalties!;
        score1 = result!.team1Penalties;
        score2 = result!.team2Penalties;
    } else {
        winner1 = result!.team1Score > result!.team2Score;
        winner2 = result!.team2Score > result!.team1Score;
        score1 = result!.team1Score;
        score2 = result!.team2Score;
    }

    return (
        <div className="relative">
            <div className="flex flex-col gap-2">
                <TeamDisplay team={match.team1} score={score1} winner={winner1} />
                <TeamDisplay team={match.team2} score={score2} winner={winner2} />
            </div>
            {hasPenalties && <div className="absolute top-1/2 -right-6 -translate-y-1/2 text-xs text-slate-400 font-bold">(P)</div>}
        </div>
    );
};

const TournamentBracket: React.FC<TournamentBracketProps> = ({ tournament }) => {
  const roundNames = ['Çeyrek Final', 'Yarı Final', 'Final'];

  return (
    <div className="flex justify-center items-start gap-4 md:gap-12 p-2 md:p-6 text-white overflow-x-auto">
      {tournament.rounds.map((round, roundIndex) => (
        <div key={roundIndex} className="flex flex-col items-center gap-4 md:gap-8 flex-shrink-0">
          <h3 className="font-extrabold text-lg md:text-2xl mb-2 md:mb-4 text-slate-300 tracking-wider">{roundNames[roundIndex]}</h3>
          <div className={`flex flex-col items-center ${roundIndex === 0 ? 'gap-4 md:gap-8' : `justify-around h-full gap-[68px] md:gap-[124px]`}`}>
            {round.map((match) => (
               <div key={match.matchId} className="relative flex items-center">
                  <Matchup match={match}/>
                  {roundIndex < tournament.rounds.length - 1 && (
                      <div className="absolute left-full top-1/2 w-3 md:w-6 h-px bg-slate-600"></div>
                  )}
               </div>
            ))}
          </div>
        </div>
      ))}
       {tournament.winner && (
         <div className="flex flex-col items-center gap-4 md:gap-8 flex-shrink-0">
             <h3 className="font-extrabold text-lg md:text-2xl mb-2 md:mb-4 text-yellow-400 tracking-wider">ŞAMPİYON</h3>
             <div className="animate-pulse">
                <TeamDisplay team={tournament.winner} winner={true} />
             </div>
         </div>
       )}
    </div>
  );
};

export default TournamentBracket;