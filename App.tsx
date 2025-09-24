import React, { useState, useCallback, useEffect, useMemo } from 'react';
import GameCanvas from './components/GameCanvas';
import { TEAMS, DIFFICULTY_LEVELS, GAME_DURATION, HALF_TIME, OVERTIME_DURATION } from './constants';
import { Team, Difficulty, League, Tournament, Fixture, TournamentNode, MatchResult } from './types';
import LeagueTable from './components/LeagueTable';
import TournamentBracket from './components/TournamentBracket';
import { generateFixtures, calculateLeagueTable, generateTournamentBracket, simulateMatch } from './utils/gameModes';
import PenaltyShootout from './components/PenaltyShootout';

type Screen = 'menu' | 'team_selection' | 'opponent_selection' | 'difficulty_selection' | 'game' | 'league_hub' | 'tournament_hub' | 'penalty_shootout' | 'settings';
type MatchState = 'first_half' | 'half_time' | 'second_half' | 'extra_time_1' | 'extra_time_2' | 'finished';
type SelectionPurpose = 'quick' | 'league' | 'tournament';
type OverlayState = 'countdown' | 'paused' | 'half_time' | 'match_result' | null;

const App = () => {
    const [screen, setScreen] = useState<Screen>('menu');
    const [player1Team, setPlayer1Team] = useState<Team>(TEAMS[0]);
    const [player2Team, setPlayer2Team] = useState<Team>(TEAMS[1]);
    const [selectedOpponent, setSelectedOpponent] = useState<Team | null>(null);
    const [isOpponentAI, setIsOpponentAI] = useState(true);
    const [difficulty, setDifficulty] = useState<Difficulty>('normal');
    
    const [isPaused, setIsPaused] = useState(true);
    const [score, setScore] = useState({ player1: 0, player2: 0 });
    const [triggerReset, setTriggerReset] = useState(0);
    const [gameTime, setGameTime] = useState(0);
    const [matchState, setMatchState] = useState<MatchState>('first_half');

    const [overlay, setOverlay] = useState<OverlayState>(null);
    const [countdown, setCountdown] = useState(3);

    const [league, setLeague] = useState<League | null>(() => {
        const saved = localStorage.getItem('league');
        return saved ? JSON.parse(saved) : null;
    });
    const [tournament, setTournament] = useState<Tournament | null>(() => {
        const saved = localStorage.getItem('tournament');
        return saved ? JSON.parse(saved) : null;
    });
    
    const [selectionPurpose, setSelectionPurpose] = useState<SelectionPurpose>('quick');
    const [currentMatch, setCurrentMatch] = useState<{team1: Team, team2: Team} | null>(null);
    const [penaltyResult, setPenaltyResult] = useState<{ team1: number, team2: number } | null>(null);

    useEffect(() => {
        if(league) localStorage.setItem('league', JSON.stringify(league));
    }, [league]);

    useEffect(() => {
        if(tournament) localStorage.setItem('tournament', JSON.stringify(tournament));
    }, [tournament]);

    const handleGoal = useCallback((scorer: 'player1' | 'player2') => {
        setScore(prevScore => {
            const newScore = { ...prevScore };
            if (scorer === 'player1') {
                newScore.player1++;
            } else {
                newScore.player2++;
            }
            return newScore;
        });
        setIsPaused(true);
        setTimeout(() => {
            setTriggerReset(val => val + 1);
            setIsPaused(false);
        }, 3000);
    }, []);
    
    const resetMatchState = () => {
        setScore({ player1: 0, player2: 0 });
        setGameTime(0);
        setMatchState('first_half');
        setTriggerReset(0);
        setIsPaused(true);
        setOverlay(null);
        setCurrentMatch(null);
        setPenaltyResult(null);
    };

    const startMatch = (team1: Team, team2: Team, isAI: boolean) => {
        resetMatchState();
        setCurrentMatch({ team1, team2 });
        setIsOpponentAI(isAI);
        setTriggerReset(1);
        
        setCountdown(3);
        setOverlay('countdown');
        setIsPaused(true);
        setScreen('game');
    };

    const handleContinueGame = (purpose: 'league' | 'tournament') => {
        setSelectionPurpose(purpose);
        if (purpose === 'league' && league) {
            setPlayer1Team(league.table.find(t => t.team.abbr === player1Team.abbr)?.team || TEAMS[0]);
            setScreen('league_hub');
        } else if (purpose === 'tournament' && tournament) {
            setPlayer1Team(tournament.playerTeam);
            setScreen('tournament_hub');
        }
    };
    
    const startNewGame = (purpose: 'league' | 'tournament') => {
        if (purpose === 'league') {
            localStorage.removeItem('league');
            setLeague(null);
        } else {
            localStorage.removeItem('tournament');
            setTournament(null);
        }
        setSelectionPurpose(purpose);
        setScreen('team_selection');
    };

    const handleTeamSelected = (team: Team) => {
        setPlayer1Team(team);
        if (selectionPurpose === 'league') {
            const fixtures = generateFixtures(TEAMS);
            const table = calculateLeagueTable(TEAMS, []);
            setLeague({ fixtures, table, currentWeek: 0 });
            setScreen('league_hub');
        } else if (selectionPurpose === 'tournament') {
            const newTournament = generateTournamentBracket(TEAMS, team);
            setTournament(newTournament);
            setScreen('tournament_hub');
        } else {
            setSelectedOpponent(null);
            setScreen('opponent_selection');
        }
    };
    
    const finishMatch = useCallback(() => {
        if (!currentMatch) return;
        
        const isPlayerTeam1 = currentMatch.team1.abbr === player1Team.abbr;
        
        let result: MatchResult;

        if (penaltyResult) {
            result = {
                team1Score: isPlayerTeam1 ? score.player1 : score.player2,
                team2Score: isPlayerTeam1 ? score.player2 : score.player1,
                team1Penalties: penaltyResult.team1,
                team2Penalties: penaltyResult.team2,
            };
        } else {
            result = {
                team1Score: isPlayerTeam1 ? score.player1 : score.player2,
                team2Score: isPlayerTeam1 ? score.player2 : score.player1,
            };
        }

        const winner = (penaltyResult ? (result.team1Penalties! > result.team2Penalties!) : (result.team1Score > result.team2Score)) ? currentMatch.team1 : currentMatch.team2;


        if (selectionPurpose === 'league' && league) {
            const updatedFixtures = league.fixtures.map(f => {
                if(f.round === league.currentWeek + 1 && f.team1.abbr === currentMatch.team1.abbr && f.team2.abbr === currentMatch.team2.abbr) {
                    return {...f, result};
                }
                if(f.round === league.currentWeek + 1 && !f.result && f.team1.abbr !== player1Team.abbr && f.team2.abbr !== player1Team.abbr) {
                    return {...f, result: simulateMatch()};
                }
                return f;
            });
            const updatedTable = calculateLeagueTable(TEAMS, updatedFixtures);
            setLeague({ ...league, fixtures: updatedFixtures, table: updatedTable, currentWeek: league.currentWeek + 1 });
            setScreen('league_hub');
        } else if (selectionPurpose === 'tournament' && tournament) {
            const newRounds = JSON.parse(JSON.stringify(tournament.rounds));
            const currentRoundNodes = newRounds[tournament.currentRound];
            const matchNode = currentRoundNodes.find((n: TournamentNode) => n.team1?.abbr === currentMatch.team1.abbr && n.team2?.abbr === currentMatch.team2.abbr);
            
            if (matchNode) {
                matchNode.result = result;
                matchNode.winner = winner;
            }

            currentRoundNodes.forEach((node: TournamentNode) => {
                if(!node.result && node.team1 && node.team2) {
                    const simResult = simulateMatch();
                    node.result = simResult;
                    node.winner = simResult.team1Score > simResult.team2Score ? node.team1 : node.team2;
                }
            });

            if (tournament.currentRound < tournament.rounds.length - 1) {
                const nextRoundNodes = newRounds[tournament.currentRound + 1];
                for(let i = 0; i < currentRoundNodes.length; i+=2) {
                    const winner1 = currentRoundNodes[i].winner;
                    const winner2 = currentRoundNodes[i+1]?.winner;
                    if(winner1 && winner2) {
                        nextRoundNodes[i/2].team1 = winner1;
                        nextRoundNodes[i/2].team2 = winner2;
                    }
                }
                 setTournament({...tournament, rounds: newRounds, currentRound: tournament.currentRound + 1});
            } else {
                 setTournament({...tournament, rounds: newRounds, winner: matchNode.winner });
            }
           
            setScreen('tournament_hub');
        } else {
            setScreen('menu');
        }
        resetMatchState();
    }, [currentMatch, player1Team, score, selectionPurpose, league, tournament, penaltyResult]);

    const isPlayerTeam1 = useMemo(() => {
        if (!currentMatch) return true;
        return currentMatch.team1.abbr === player1Team.abbr;
    }, [currentMatch, player1Team]);

    const handlePenaltyFinish = (winner: 'player' | 'ai', penaltyScores: { player: number, ai: number }) => {
        setScreen('game');
        
        const penaltyData = isPlayerTeam1 
            ? { team1: penaltyScores.player, team2: penaltyScores.ai }
            : { team1: penaltyScores.ai, team2: penaltyScores.player };
        
        setPenaltyResult(penaltyData);
        
        setMatchState('finished');
        setIsPaused(true);
        setOverlay('match_result');
    }

    const handleExitMatch = () => {
        if (selectionPurpose === 'league') setScreen('league_hub');
        else if (selectionPurpose === 'tournament') setScreen('tournament_hub');
        else setScreen('menu');
        resetMatchState();
    };

    const handleReturnToMenu = () => {
        setScreen('menu');
        resetMatchState();
    };

     useEffect(() => {
        if (overlay === 'countdown' && countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else if (overlay === 'countdown' && countdown === 0) {
            setOverlay(null);
            setIsPaused(false);
        }
    }, [overlay, countdown]);


    useEffect(() => {
        if (isPaused || screen !== 'game') return;

        const timer = setInterval(() => {
            setGameTime(t => {
                const newTime = t + 1; // 1 game minute per real second
                switch (matchState) {
                    case 'first_half':
                        if (newTime >= HALF_TIME) {
                            setIsPaused(true);
                            setMatchState('half_time');
                            setOverlay('half_time');
                            return HALF_TIME;
                        }
                        break;
                    case 'second_half':
                        if (newTime >= GAME_DURATION) {
                            setIsPaused(true);
                            if ((selectionPurpose === 'tournament' || selectionPurpose === 'quick') && score.player1 === score.player2) {
                                setMatchState('extra_time_1');
                                setOverlay('half_time');
                            } else {
                                setMatchState('finished');
                                setOverlay('match_result');
                            }
                            return GAME_DURATION;
                        }
                        break;
                    case 'extra_time_1':
                         if (newTime >= GAME_DURATION + OVERTIME_DURATION) {
                              setIsPaused(true);
                              setMatchState('extra_time_2');
                              setOverlay('half_time');
                              return GAME_DURATION + OVERTIME_DURATION;
                         }
                         break;
                    case 'extra_time_2':
                        if (newTime >= GAME_DURATION + OVERTIME_DURATION * 2) {
                            setIsPaused(true);
                             if (score.player1 === score.player2) {
                                setScreen('penalty_shootout');
                            } else {
                               setMatchState('finished');
                               setOverlay('match_result');
                            }
                            return GAME_DURATION + OVERTIME_DURATION * 2;
                        }
                        break;
                }
                return newTime;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isPaused, screen, matchState, selectionPurpose, score]);
    
    const playerNextLeagueMatch = useMemo(() => {
        if (!league || league.currentWeek >= (TEAMS.length - 1) * 2) return null;
        return league.fixtures.find(f => f.round === league.currentWeek + 1 && (f.team1.abbr === player1Team.abbr || f.team2.abbr === player1Team.abbr));
    }, [league, player1Team]);

    const playerNextTournamentMatch = useMemo(() => {
        if (!tournament || tournament.winner || tournament.currentRound >= tournament.rounds.length) return null;
        const currentRoundFixtures = tournament.rounds[tournament.currentRound];
        return currentRoundFixtures.find(m => m.team1?.abbr === player1Team.abbr || m.team2?.abbr === player1Team.abbr);
    }, [tournament, player1Team]);

    const renderOverlay = () => {
        if (!overlay) return null;

        const getHalfTimeMessage = () => {
            switch(matchState) {
                case 'half_time': return 'Devre Arası';
                case 'extra_time_1': return 'Uzatma Devresi Başlıyor';
                case 'extra_time_2': return 'İkinci Uzatma Devresi';
                default: return 'Devam Et';
            }
        };
        
        const startNextPhase = () => {
            if (matchState === 'half_time') setMatchState('second_half');
            else if (matchState === 'extra_time_1') setMatchState('extra_time_1');
            else if (matchState === 'extra_time_2') setMatchState('extra_time_2');
            setTriggerReset(val => val + 1);
            setCountdown(3);
            setOverlay('countdown');
        };

        return (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4 z-50">
                {overlay === 'countdown' && (
                    <div className="text-8xl font-extrabold text-white animate-ping">
                        {countdown > 0 ? countdown : 'BAŞLA!'}
                    </div>
                )}
                {overlay === 'paused' && (
                    <div className="bg-slate-800/80 p-8 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col gap-4 w-72">
                        <h2 className="text-4xl font-bold mb-4">Oyun Durdu</h2>
                        <button onClick={() => { setOverlay(null); setIsPaused(false); }} className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-bold">Devam Et</button>
                        <button onClick={handleExitMatch} className="w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Maçtan Çekil</button>
                    </div>
                )}
                 {overlay === 'half_time' && (
                    <div className="bg-slate-800/80 p-8 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col gap-4 w-80">
                        <h2 className="text-4xl font-bold mb-4">{getHalfTimeMessage()}</h2>
                        <p className="text-2xl font-bold">{isPlayerTeam1 ? score.player1 : score.player2} - {isPlayerTeam1 ? score.player2 : score.player1}</p>
                        <button onClick={startNextPhase} className="mt-4 w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-bold">Sonraki Devre</button>
                    </div>
                )}
                 {overlay === 'match_result' && (
                    <div className="bg-slate-800/80 p-8 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col gap-4 w-80">
                        <h2 className="text-4xl font-bold mb-2">Maç Bitti</h2>
                        <p className="text-6xl font-extrabold my-4 animate-score-pop">{isPlayerTeam1 ? score.player1 : score.player2} - {isPlayerTeam1 ? score.player2 : score.player1}</p>
                        <button onClick={finishMatch} className="mt-4 w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-bold">Devam Et</button>
                        <button onClick={handleReturnToMenu} className="w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Ana Menü</button>
                    </div>
                )}
            </div>
        );
    };

    const renderScreen = () => {
        switch (screen) {
            case 'menu': return (
                <div className="w-full max-w-md bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col gap-4">
                    <h1 className="text-5xl font-extrabold text-center text-white drop-shadow-lg mb-4">Parmak Futbolu</h1>
                    
                    <button onClick={() => { setSelectionPurpose('quick'); setScreen('team_selection'); }} className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-transform duration-200">Hızlı Maç</button>
                    
                    <div className="border-t border-slate-700 my-2"></div>

                    {league && <button onClick={() => handleContinueGame('league')} className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-transform duration-200">Lige Devam Et ({league.currentWeek}. Hafta)</button>}
                    <button onClick={() => startNewGame('league')} className="w-full px-6 py-3 bg-blue-800/80 hover:bg-blue-700/80 rounded-lg text-lg font-semibold shadow-md">Yeni Lige Başla</button>

                    <div className="border-t border-slate-700 my-2"></div>
                    
                    {tournament && !tournament.winner && <button onClick={() => handleContinueGame('tournament')} className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-transform duration-200">Turnuvaya Devam Et</button>}
                    <button onClick={() => startNewGame('tournament')} className="w-full px-6 py-3 bg-purple-800/80 hover:bg-purple-700/80 rounded-lg text-lg font-semibold shadow-md">Yeni Turnuvaya Başla</button>
                </div>
            );
            case 'team_selection': return (
                <div className="w-full max-w-2xl bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700/50">
                    <h2 className="text-3xl font-bold mb-4 text-center">Takımını Seç</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {TEAMS.map(team => (
                            <button key={team.abbr} onClick={() => handleTeamSelected(team)} className={`p-3 rounded-lg border-4 transition-all duration-200 ${player1Team.abbr === team.abbr ? 'border-yellow-400 scale-105 shadow-lg' : 'border-transparent hover:border-slate-500/50'}`}>
                                <div className="w-16 h-16 mx-auto rounded-full border-2 border-slate-400/50 mb-2" style={{ background: `linear-gradient(to right, ${team.color1} 50%, ${team.color2} 50%)` }}></div>
                                <span className="font-bold text-lg">{team.abbr}</span>
                            </button>
                        ))}
                    </div>
                     <button onClick={() => setScreen('menu')} className="mt-6 w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Geri</button>
                </div>
            );
            case 'opponent_selection': return (
                <div className="w-full max-w-3xl bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col items-center">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-6 text-center text-slate-100">Rakibini Seç</h2>
                    <div className="flex justify-around items-center w-full mb-6">
                        <div className="flex flex-col items-center p-2 md:p-4 rounded-lg bg-slate-700/50 border-2 border-blue-500 w-36 md:w-48 text-center">
                            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full border-4 border-slate-400/50 mb-3" style={{ background: `linear-gradient(to right, ${player1Team.color1} 50%, ${player1Team.color2} 50%)` }}></div>
                            <h3 className="font-bold text-xl md:text-2xl truncate">{player1Team.name}</h3>
                            <p className="text-slate-400 text-sm md:text-base">(Sensin)</p>
                        </div>
                        <span className="text-4xl md:text-6xl font-black text-slate-500 mx-2 md:mx-4">VS</span>
                        <div className={`flex flex-col items-center p-2 md:p-4 rounded-lg w-36 md:w-48 text-center transition-all duration-300 ${selectedOpponent ? 'bg-slate-700/50 border-2 border-red-500' : 'bg-slate-900/50 border-2 border-dashed border-slate-600'}`}>
                            {selectedOpponent ? (
                                <>
                                    <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full border-4 border-slate-400/50 mb-3" style={{ background: `linear-gradient(to right, ${selectedOpponent.color1} 50%, ${selectedOpponent.color2} 50%)` }}></div>
                                    <h3 className="font-bold text-xl md:text-2xl truncate">{selectedOpponent.name}</h3>
                                    <p className="text-slate-400 text-sm md:text-base">(Rakip)</p>
                                </>
                            ) : (
                                <>
                                     <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full bg-slate-700 flex items-center justify-center mb-3">
                                        <span className="text-4xl text-slate-500">?</span>
                                     </div>
                                     <h3 className="font-bold text-xl md:text-2xl text-slate-500">Rakip Seç</h3>
                                     <p className="text-slate-600 text-sm md:text-base">(Aşağıdan seç)</p>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="w-full border-t border-slate-700 pt-6">
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 md:gap-4">
                            {TEAMS.map(team => (
                                <button 
                                    key={team.abbr} 
                                    onClick={() => setSelectedOpponent(team)} 
                                    disabled={player1Team.abbr === team.abbr}
                                    className={`p-2 md:p-3 rounded-lg border-4 transition-all duration-200 ${selectedOpponent?.abbr === team.abbr ? 'border-yellow-400 scale-110 shadow-lg' : 'border-transparent hover:border-slate-500/50'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:scale-100`}
                                >
                                    <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full border-2 border-slate-400/50 mb-2" style={{ background: `linear-gradient(to right, ${team.color1} 50%, ${team.color2} 50%)` }}></div>
                                    <span className="font-bold text-sm md:text-md">{team.abbr}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between w-full mt-8">
                         <button onClick={() => setScreen('team_selection')} className="px-8 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Geri</button>
                         <button 
                            onClick={() => {
                                if (selectedOpponent) {
                                    setPlayer2Team(selectedOpponent);
                                    setScreen('difficulty_selection');
                                }
                            }} 
                            disabled={!selectedOpponent} 
                            className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-bold disabled:bg-slate-600 disabled:cursor-not-allowed">
                            Devam Et
                         </button>
                    </div>
                </div>
            );
             case 'difficulty_selection': return (
                <div className="w-full max-w-md bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col gap-3">
                    <h2 className="text-3xl font-bold mb-2 text-center">Zorluk Seç</h2>
                    {DIFFICULTY_LEVELS.map(level => (
                        <button key={level.id} onClick={() => {
                            setDifficulty(level.id);
                            startMatch(player1Team, player2Team, true);
                        }} className={`w-full px-6 py-3 rounded-lg text-lg font-bold transition-all duration-200 ${difficulty === level.id ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{level.label}</button>
                    ))}
                     <button onClick={() => setScreen('opponent_selection')} className="mt-4 w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Geri</button>
                </div>
            );
            case 'game': 
                if (!currentMatch) return null;
                const playerPaddleTeam = player1Team;
                const opponentPaddleTeam = currentMatch.team1.abbr === player1Team.abbr ? currentMatch.team2 : currentMatch.team1;

                return (
                <div className="w-full max-w-sm relative">
                   {renderOverlay()}
                   <div className="flex justify-between items-center p-3 bg-slate-900/70 rounded-t-lg border-b-2 border-slate-700/50">
                       <div className="flex items-center gap-2 font-bold text-lg">
                           <div className="w-7 h-7 rounded-full border-2 border-slate-500" style={{ background: `linear-gradient(to right, ${currentMatch.team1.color1} 50%, ${currentMatch.team1.color2} 50%)` }}></div>
                           <span>{currentMatch.team1.abbr}</span>
                       </div>
                       <div className="text-center">
                            <span className={`text-4xl font-extrabold tracking-wider ${overlay === 'match_result' ? 'animate-score-pop' : ''}`}>{isPlayerTeam1 ? score.player1 : score.player2} - {isPlayerTeam1 ? score.player2 : score.player1}</span>
                            <div className="text-xl font-bold text-yellow-400">{Math.floor(gameTime)}'</div>
                       </div>
                        <div className="flex items-center gap-2 font-bold text-lg">
                           <span>{currentMatch.team2.abbr}</span>
                           <div className="w-7 h-7 rounded-full border-2 border-slate-500" style={{ background: `linear-gradient(to right, ${currentMatch.team2.color1} 50%, ${currentMatch.team2.color2} 50%)` }}></div>
                       </div>
                   </div>
                   <GameCanvas
                        player1Team={playerPaddleTeam}
                        player2Team={opponentPaddleTeam}
                        isOpponentAI={isOpponentAI}
                        difficulty={difficulty}
                        isPaused={isPaused}
                        onGoal={handleGoal}
                        triggerReset={triggerReset}
                        controlSplitRatio={0.5}
                    />
                     <div className="flex justify-center p-2 bg-slate-900/70 rounded-b-lg gap-4">
                       <button onClick={() => { setIsPaused(true); setOverlay('paused'); }} className="px-5 py-2 bg-yellow-600/80 hover:bg-yellow-500 rounded-lg font-bold" disabled={isPaused || overlay === 'match_result'}>Duraklat</button>
                    </div>
                </div>
            );
             case 'league_hub': if (!league) return null; return (
                <div className="w-full max-w-4xl flex flex-col items-center gap-6">
                    <h2 className="text-4xl font-extrabold">Lig Modu</h2>
                    <LeagueTable table={league.table} playerTeam={player1Team} />
                    {playerNextLeagueMatch && (
                        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                            <h3 className="text-xl font-bold mb-2">{league.currentWeek + 1}. Hafta Maçı</h3>
                            <p className="text-lg">{playerNextLeagueMatch.team1.abbr} vs {playerNextLeagueMatch.team2.abbr}</p>
                            <button onClick={() => startMatch(playerNextLeagueMatch.team1, playerNextLeagueMatch.team2, true)} className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold">Maça Başla</button>
                        </div>
                    )}
                    {league.currentWeek >= (TEAMS.length-1) * 2 && <p className="text-2xl font-bold text-yellow-400">Lig Bitti!</p>}
                    <button onClick={() => setScreen('menu')} className="mt-4 px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg font-bold">Ana Menü</button>
                </div>
             );
            case 'tournament_hub': if (!tournament) return null; 
                const isWinner = tournament.winner && tournament.winner.abbr === player1Team.abbr;
                const isLoser = tournament.winner && tournament.winner.abbr !== player1Team.abbr;
                const isEliminated = !playerNextTournamentMatch && !tournament.winner;
            return (
                <div className="w-full max-w-6xl flex flex-col items-center gap-6">
                    <h2 className="text-4xl font-extrabold">Turnuva Modu</h2>
                    <TournamentBracket tournament={tournament} />
                    {playerNextTournamentMatch && !tournament.winner && (
                        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                             <h3 className="text-xl font-bold mb-2">Sıradaki Maç</h3>
                            <p className="text-lg">{playerNextTournamentMatch.team1?.abbr} vs {playerNextTournamentMatch.team2?.abbr}</p>
                            <button onClick={() => startMatch(playerNextTournamentMatch.team1!, playerNextTournamentMatch.team2!, true)} className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold">Maça Başla</button>
                        </div>
                    )}
                    {isWinner && <p className="text-3xl font-bold text-yellow-400 animate-pulse">TURNUVAYI KAZANDIN!</p>}
                    {isLoser && <p className="text-2xl font-bold text-red-500">Turnuvayı Kaybettin!</p>}
                    {isEliminated && <p className="text-2xl font-bold text-red-500">Turnuvadan Elendin!</p>}
                    <button onClick={() => setScreen('menu')} className="mt-4 px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg font-bold">Ana Menü</button>
                </div>
            );
            case 'penalty_shootout': if(!currentMatch) return null; return (
                <PenaltyShootout 
                    playerTeam={isPlayerTeam1 ? currentMatch.team1 : currentMatch.team2}
                    aiTeam={isPlayerTeam1 ? currentMatch.team2 : currentMatch.team1}
                    difficulty={difficulty}
                    onFinish={handlePenaltyFinish}
                />
            );
            default: return <div>Bilinmeyen Ekran</div>;
        }
    };

    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
            {renderScreen()}
        </div>
    );
};

export default App;