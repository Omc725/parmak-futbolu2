import React, { useState, useCallback, useEffect, useMemo } from 'react';
import OyunAlani from './bilesenler/OyunAlani';
import { TEAMS, DIFFICULTY_LEVELS, GAME_DURATION, HALF_TIME, OVERTIME_DURATION } from './sabitler';
import { Team, Difficulty, League, Tournament, TournamentNode, MatchResult } from './tipler';
import LigTablosu from './bilesenler/LigTablosu';
import TurnuvaFiksturu from './bilesenler/TurnuvaFiksturu';
import { generateFixtures, calculateLeagueTable, generateTournamentBracket, simulateMatch } from './yardimcilar/oyunModlari';
import PenaltiAtislari from './bilesenler/PenaltiAtislari';

type Screen = 'menu' | 'takim_secimi' | 'rakip_secimi' | 'zorluk_secimi' | 'oyun' | 'lig_merkezi' | 'turnuva_merkezi' | 'penalti_atis' | 'ayarlar';
type MatchState = 'ilk_yari' | 'devre_arasi' | 'ikinci_yari' | 'uzatma_arasi_1' | 'uzatma_1' | 'uzatma_arasi_2' | 'uzatma_2' | 'bitti';
type SelectionPurpose = 'hizli' | 'lig' | 'turnuva';
type OverlayState = 'geri_sayim' | 'duraklatildi' | 'devre_arasi' | 'mac_sonucu' | null;

const Uygulama = () => {
    const [ekran, setEkran] = useState<Screen>('menu');
    const [oyuncu1Takimi, setOyuncu1Takimi] = useState<Team>(TEAMS[0]);
    const [oyuncu2Takimi, setOyuncu2Takimi] = useState<Team>(TEAMS[1]);
    const [seciliRakip, setSeciliRakip] = useState<Team | null>(null);
    const [rakipYapayZeka, setRakipYapayZeka] = useState(true);
    const [zorluk, setZorluk] = useState<Difficulty>('normal');
    
    const [duraklatildi, setDuraklatildi] = useState(true);
    const [skor, setSkor] = useState({ player1: 0, player2: 0 });
    const [sifirlamaTetikleyici, setSifirlamaTetikleyici] = useState(0);
    const [oyunSuresi, setOyunSuresi] = useState(0);
    const [macDurumu, setMacDurumu] = useState<MatchState>('ilk_yari');

    const [gecisEkrani, setGecisEkrani] = useState<OverlayState>(null);
    const [geriSayim, setGeriSayim] = useState(3);

    const [lig, setLig] = useState<League | null>(() => {
        const saved = localStorage.getItem('lig');
        return saved ? JSON.parse(saved) : null;
    });
    const [turnuva, setTurnuva] = useState<Tournament | null>(() => {
        const saved = localStorage.getItem('tournament');
        return saved ? JSON.parse(saved) : null;
    });
    
    const [secimAmaci, setSecimAmaci] = useState<SelectionPurpose>('hizli');
    const [aktifMac, setAktifMac] = useState<{team1: Team, team2: Team} | null>(null);
    const [penaltiSonucu, setPenaltiSonucu] = useState<{ team1: number, team2: number } | null>(null);

    useEffect(() => {
        if(lig) localStorage.setItem('lig', JSON.stringify(lig));
    }, [lig]);

    useEffect(() => {
        if(turnuva) localStorage.setItem('turnuva', JSON.stringify(turnuva));
    }, [turnuva]);

    const handleGoal = useCallback((scorer: 'player1' | 'player2') => {
        setSkor(prevSkor => {
            const newScore = { ...prevSkor };
            if (scorer === 'player1') {
                newScore.player1++;
            } else {
                newScore.player2++;
            }
            return newScore;
        });
        setDuraklatildi(true);
        setTimeout(() => {
            setSifirlamaTetikleyici(val => val + 1);
            setDuraklatildi(false);
        }, 3000);
    }, []);
    
    const macDurumunuSifirla = () => {
        setSkor({ player1: 0, player2: 0 });
        setOyunSuresi(0);
        setMacDurumu('ilk_yari');
        setSifirlamaTetikleyici(0);
        setDuraklatildi(true);
        setGecisEkrani(null);
        setAktifMac(null);
        setPenaltiSonucu(null);
    };

    const maciBaslat = (team1: Team, team2: Team, isAI: boolean) => {
        macDurumunuSifirla();
        setAktifMac({ team1, team2 });
        setRakipYapayZeka(isAI);
        setSifirlamaTetikleyici(1);
        
        setGeriSayim(3);
        setGecisEkrani('geri_sayim');
        setDuraklatildi(true);
        setEkran('oyun');
    };

    const oyunaDevamEt = (amac: 'lig' | 'turnuva') => {
        setSecimAmaci(amac);
        if (amac === 'lig' && lig) {
            setOyuncu1Takimi(lig.table.find(t => t.team.abbr === oyuncu1Takimi.abbr)?.team || TEAMS[0]);
            setEkran('lig_merkezi');
        } else if (amac === 'turnuva' && turnuva) {
            setOyuncu1Takimi(turnuva.playerTeam);
            setEkran('turnuva_merkezi');
        }
    };
    
    const yeniOyunBaslat = (amac: 'lig' | 'turnuva') => {
        if (amac === 'lig') {
            localStorage.removeItem('lig');
            setLig(null);
        } else {
            localStorage.removeItem('turnuva');
            setTurnuva(null);
        }
        setSecimAmaci(amac);
        setEkran('takim_secimi');
    };

    const takimSecildi = (team: Team) => {
        setOyuncu1Takimi(team);
        if (secimAmaci === 'hizli') {
            setSeciliRakip(null);
            setEkran('rakip_secimi');
        } else if (secimAmaci === 'lig') {
            const fixtures = generateFixtures(TEAMS);
            const table = calculateLeagueTable(TEAMS, []);
            setLig({ fixtures, table, currentWeek: 0 });
            setEkran('lig_merkezi');
        } else if (secimAmaci === 'turnuva') {
            const newTournament = generateTournamentBracket(TEAMS, team);
            setTurnuva(newTournament);
            setEkran('turnuva_merkezi');
        }
    };
    
    const maciBitir = useCallback(() => {
        if (!aktifMac) return;
        
        const isPlayerTeam1 = aktifMac.team1.abbr === oyuncu1Takimi.abbr;
        
        let result: MatchResult;

        if (penaltiSonucu) {
            result = {
                team1Score: isPlayerTeam1 ? skor.player1 : skor.player2,
                team2Score: isPlayerTeam1 ? skor.player2 : skor.player1,
                team1Penalties: penaltiSonucu.team1,
                team2Penalties: penaltiSonucu.team2,
            };
        } else {
            result = {
                team1Score: isPlayerTeam1 ? skor.player1 : skor.player2,
                team2Score: isPlayerTeam1 ? skor.player2 : skor.player1,
            };
        }
        
        const winner = (penaltiSonucu ? (result.team1Penalties! > result.team2Penalties!) : (result.team1Score > result.team2Score)) ? aktifMac.team1 : aktifMac.team2;

        if (secimAmaci === 'lig' && lig) {
            const updatedFixtures = lig.fixtures.map(f => {
                if(f.round === lig.currentWeek + 1 && f.team1.abbr === aktifMac.team1.abbr && f.team2.abbr === aktifMac.team2.abbr) {
                    return {...f, result};
                }
                if(f.round === lig.currentWeek + 1 && !f.result && f.team1.abbr !== oyuncu1Takimi.abbr && f.team2.abbr !== oyuncu1Takimi.abbr) {
                    return {...f, result: simulateMatch()};
                }
                return f;
            });
            const updatedTable = calculateLeagueTable(TEAMS, updatedFixtures);
            setLig({ ...lig, fixtures: updatedFixtures, table: updatedTable, currentWeek: lig.currentWeek + 1 });
            setEkran('lig_merkezi');
        } else if (secimAmaci === 'turnuva' && turnuva) {
            const newRounds = JSON.parse(JSON.stringify(turnuva.rounds));
            const currentRoundNodes = newRounds[turnuva.currentRound];
            const matchNode = currentRoundNodes.find((n: TournamentNode) => n.team1?.abbr === aktifMac.team1.abbr && n.team2?.abbr === aktifMac.team2.abbr);
            
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

            if (turnuva.currentRound < turnuva.rounds.length - 1) {
                const nextRoundNodes = newRounds[turnuva.currentRound + 1];
                for(let i = 0; i < currentRoundNodes.length; i+=2) {
                    const winner1 = currentRoundNodes[i].winner;
                    const winner2 = currentRoundNodes[i+1]?.winner; 
                    if(winner1 && winner2) {
                        nextRoundNodes[i/2].team1 = winner1;
                        nextRoundNodes[i/2].team2 = winner2;
                    }
                }
                 setTurnuva({...turnuva, rounds: newRounds, currentRound: turnuva.currentRound + 1});
            } else {
                 setTurnuva({...turnuva, rounds: newRounds, winner: matchNode.winner });
            }
           
            setEkran('turnuva_merkezi');
        } else {
            setEkran('menu');
        }
        macDurumunuSifirla();
    }, [aktifMac, oyuncu1Takimi, skor, secimAmaci, lig, turnuva, penaltiSonucu]);

    const isPlayerTeam1 = useMemo(() => {
        if (!aktifMac) return true;
        return aktifMac.team1.abbr === oyuncu1Takimi.abbr;
    }, [aktifMac, oyuncu1Takimi]);

    const penaltiBitti = useCallback((winner: 'player' | 'ai', penaltyScores: { player: number, ai: number }) => {
        setEkran('oyun'); 
        
        const penaltyData = isPlayerTeam1 
            ? { team1: penaltyScores.player, team2: penaltyScores.ai }
            : { team1: penaltyScores.ai, team2: penaltyScores.player };
        
        setPenaltiSonucu(penaltyData);
        
        setMacDurumu('bitti');
        setDuraklatildi(true);
        setGecisEkrani('mac_sonucu');
    }, [isPlayerTeam1]);

    const macdanCik = () => {
        if (secimAmaci === 'lig') setEkran('lig_merkezi');
        else if (secimAmaci === 'turnuva') setEkran('turnuva_merkezi');
        else setEkran('menu');
        macDurumunuSifirla();
    };

    const anaMenuyeDon = () => {
        setEkran('menu');
        macDurumunuSifirla();
    };

     useEffect(() => {
        if (gecisEkrani === 'geri_sayim' && geriSayim > 0) {
            const timer = setTimeout(() => setGeriSayim(c => c - 1), 1000);
            return () => clearTimeout(timer);
        } else if (gecisEkrani === 'geri_sayim' && geriSayim === 0) {
            setGecisEkrani(null);
            setDuraklatildi(false);
        }
    }, [gecisEkrani, geriSayim]);


    useEffect(() => {
        if (duraklatildi || ekran !== 'oyun') return;

        const timer = setInterval(() => {
            setOyunSuresi(t => {
                const newTime = t + 1; // 1 saniye = 1 oyun dakikası
                switch (macDurumu) {
                    case 'ilk_yari':
                        if (newTime >= HALF_TIME) {
                            setDuraklatildi(true);
                            setMacDurumu('devre_arasi');
                            setGecisEkrani('devre_arasi');
                            return HALF_TIME;
                        }
                        break;
                    case 'ikinci_yari':
                        if (newTime >= GAME_DURATION) {
                            setDuraklatildi(true);
                            if ((secimAmaci === 'turnuva' || secimAmaci === 'hizli') && skor.player1 === skor.player2) {
                                setMacDurumu('uzatma_arasi_1');
                                setGecisEkrani('devre_arasi');
                            } else {
                                setMacDurumu('bitti');
                                setGecisEkrani('mac_sonucu');
                            }
                            return GAME_DURATION;
                        }
                        break;
                    case 'uzatma_1':
                         if (newTime >= GAME_DURATION + OVERTIME_DURATION) {
                              setDuraklatildi(true);
                              setMacDurumu('uzatma_arasi_2');
                              setGecisEkrani('devre_arasi');
                              return GAME_DURATION + OVERTIME_DURATION;
                         }
                         break;
                    case 'uzatma_2':
                        if (newTime >= GAME_DURATION + OVERTIME_DURATION * 2) {
                            setDuraklatildi(true);
                             if (skor.player1 === skor.player2) {
                                setEkran('penalti_atis');
                            } else {
                               setMacDurumu('bitti');
                               setGecisEkrani('mac_sonucu');
                            }
                            return GAME_DURATION + OVERTIME_DURATION * 2;
                        }
                        break;
                }
                return newTime;
            });
        }, 1000); 

        return () => clearInterval(timer);
    }, [duraklatildi, ekran, macDurumu, secimAmaci, skor]);
    
    const siradakiLigMaci = useMemo(() => {
        if (!lig || lig.currentWeek >= (TEAMS.length - 1) * 2) return null;
        return lig.fixtures.find(f => f.round === lig.currentWeek + 1 && (f.team1.abbr === oyuncu1Takimi.abbr || f.team2.abbr === oyuncu1Takimi.abbr));
    }, [lig, oyuncu1Takimi]);

    const siradakiTurnuvaMaci = useMemo(() => {
        if (!turnuva || turnuva.winner || turnuva.currentRound >= turnuva.rounds.length) return null;
        const currentRoundFixtures = turnuva.rounds[turnuva.currentRound];
        return currentRoundFixtures.find(m => m.team1?.abbr === oyuncu1Takimi.abbr || m.team2?.abbr === oyuncu1Takimi.abbr);
    }, [turnuva, oyuncu1Takimi]);

    const gecisEkraniOlustur = () => {
        if (!gecisEkrani) return null;

        const getDevreArasiMesaji = () => {
            switch(macDurumu) {
                case 'devre_arasi': return 'Devre Arası';
                case 'uzatma_arasi_1': return 'Uzatma Devresi Başlıyor';
                case 'uzatma_arasi_2': return 'İkinci Uzatma Devresi';
                default: return 'Devam Et';
            }
        };
        
        const sonrakiAsamayiBaslat = () => {
            if (macDurumu === 'devre_arasi') setMacDurumu('ikinci_yari');
            else if (macDurumu === 'uzatma_arasi_1') setMacDurumu('uzatma_1');
            else if (macDurumu === 'uzatma_arasi_2') setMacDurumu('uzatma_2');

            setSifirlamaTetikleyici(val => val + 1);
            setGeriSayim(3);
            setGecisEkrani('geri_sayim');
        };

        return (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4 z-50">
                {gecisEkrani === 'geri_sayim' && (
                    <div className="text-8xl font-extrabold text-white animate-ping">
                        {geriSayim > 0 ? geriSayim : 'BAŞLA!'}
                    </div>
                )}
                {gecisEkrani === 'duraklatildi' && (
                    <div className="bg-slate-800/80 p-8 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col gap-4 w-72">
                        <h2 className="text-4xl font-bold mb-4">Oyun Durdu</h2>
                        <button onClick={() => { setGecisEkrani(null); setDuraklatildi(false); }} className="w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-bold">Devam Et</button>
                        <button onClick={macdanCik} className="w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Maçtan Çekil</button>
                    </div>
                )}
                 {gecisEkrani === 'devre_arasi' && (
                    <div className="bg-slate-800/80 p-8 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col gap-4 w-80">
                        <h2 className="text-4xl font-bold mb-4">{getDevreArasiMesaji()}</h2>
                        <p className="text-2xl font-bold">{isPlayerTeam1 ? skor.player1 : skor.player2} - {isPlayerTeam1 ? skor.player2 : skor.player1}</p>
                        <button onClick={sonrakiAsamayiBaslat} className="mt-4 w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-bold">Sonraki Devre</button>
                    </div>
                )}
                 {gecisEkrani === 'mac_sonucu' && (
                    <div className="bg-slate-800/80 p-8 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col gap-4 w-80">
                        <h2 className="text-4xl font-bold mb-2">Maç Bitti</h2>
                        <p className="text-6xl font-extrabold my-4 animate-score-pop">{isPlayerTeam1 ? skor.player1 : skor.player2} - {isPlayerTeam1 ? skor.player2 : skor.player1}</p>
                        <button onClick={maciBitir} className="mt-4 w-full px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-bold">Devam Et</button>
                        <button onClick={anaMenuyeDon} className="w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Ana Menü</button>
                    </div>
                )}
            </div>
        );
    };

    const ekranOlustur = () => {
        switch (ekran) {
            case 'menu': return (
                <div className="w-full max-w-md bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col gap-4">
                    <h1 className="text-5xl font-extrabold text-center text-white drop-shadow-lg mb-4">Parmak Futbolu</h1>
                    
                    <button onClick={() => { setSecimAmaci('hizli'); setEkran('takim_secimi'); }} className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-transform duration-200">Hızlı Maç</button>
                    
                    <div className="border-t border-slate-700 my-2"></div>

                    {lig && <button onClick={() => oyunaDevamEt('lig')} className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-transform duration-200">Lige Devam Et ({lig.currentWeek}. Hafta)</button>}
                    <button onClick={() => yeniOyunBaslat('lig')} className="w-full px-6 py-3 bg-blue-800/80 hover:bg-blue-700/80 rounded-lg text-lg font-semibold shadow-md">Yeni Lige Başla</button>

                    <div className="border-t border-slate-700 my-2"></div>
                    
                    {turnuva && !turnuva.winner && <button onClick={() => oyunaDevamEt('turnuva')} className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg text-xl font-bold shadow-lg transform hover:scale-105 transition-transform duration-200">Turnuvaya Devam Et</button>}
                    <button onClick={() => yeniOyunBaslat('turnuva')} className="w-full px-6 py-3 bg-purple-800/80 hover:bg-purple-700/80 rounded-lg text-lg font-semibold shadow-md">Yeni Turnuvaya Başla</button>
                </div>
            );
            case 'takim_secimi': return (
                <div className="w-full max-w-2xl bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700/50">
                    <h2 className="text-3xl font-bold mb-4 text-center">Takımını Seç</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {TEAMS.map(team => (
                            <button key={team.abbr} onClick={() => takimSecildi(team)} className={`p-3 rounded-lg border-4 transition-all duration-200 ${oyuncu1Takimi.abbr === team.abbr ? 'border-yellow-400 scale-105 shadow-lg' : 'border-transparent hover:border-slate-500/50'}`}>
                                <div className="w-16 h-16 mx-auto rounded-full border-2 border-slate-400/50 mb-2" style={{ background: `linear-gradient(to right, ${team.color1} 50%, ${team.color2} 50%)` }}></div>
                                <span className="font-bold text-lg">{team.abbr}</span>
                            </button>
                        ))}
                    </div>
                     <button onClick={() => setEkran('menu')} className="mt-6 w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Geri</button>
                </div>
            );
            case 'rakip_secimi': return (
                <div className="w-full max-w-3xl bg-slate-800/50 p-4 md:p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col items-center">
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-6 text-center text-slate-100">Rakibini Seç</h2>
                    <div className="flex justify-around items-center w-full mb-6">
                        <div className="flex flex-col items-center p-2 md:p-4 rounded-lg bg-slate-700/50 border-2 border-blue-500 w-36 md:w-48 text-center">
                            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full border-4 border-slate-400/50 mb-3" style={{ background: `linear-gradient(to right, ${oyuncu1Takimi.color1} 50%, ${oyuncu1Takimi.color2} 50%)` }}></div>
                            <h3 className="font-bold text-xl md:text-2xl truncate">{oyuncu1Takimi.name}</h3>
                            <p className="text-slate-400 text-sm md:text-base">(Sensin)</p>
                        </div>
                        <span className="text-4xl md:text-6xl font-black text-slate-500 mx-2 md:mx-4">VS</span>
                        <div className={`flex flex-col items-center p-2 md:p-4 rounded-lg w-36 md:w-48 text-center transition-all duration-300 ${seciliRakip ? 'bg-slate-700/50 border-2 border-red-500' : 'bg-slate-900/50 border-2 border-dashed border-slate-600'}`}>
                            {seciliRakip ? (
                                <>
                                    <div className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full border-4 border-slate-400/50 mb-3" style={{ background: `linear-gradient(to right, ${seciliRakip.color1} 50%, ${seciliRakip.color2} 50%)` }}></div>
                                    <h3 className="font-bold text-xl md:text-2xl truncate">{seciliRakip.name}</h3>
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
                                    onClick={() => setSeciliRakip(team)} 
                                    disabled={oyuncu1Takimi.abbr === team.abbr}
                                    className={`p-2 md:p-3 rounded-lg border-4 transition-all duration-200 ${seciliRakip?.abbr === team.abbr ? 'border-yellow-400 scale-110 shadow-lg' : 'border-transparent hover:border-slate-500/50'} disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-transparent disabled:scale-100`}
                                >
                                    <div className="w-12 h-12 md:w-16 md:h-16 mx-auto rounded-full border-2 border-slate-400/50 mb-2" style={{ background: `linear-gradient(to right, ${team.color1} 50%, ${team.color2} 50%)` }}></div>
                                    <span className="font-bold text-sm md:text-md">{team.abbr}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between w-full mt-8">
                         <button onClick={() => setEkran('takim_secimi')} className="px-8 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Geri</button>
                         <button 
                            onClick={() => {
                                if (seciliRakip) {
                                    setOyuncu2Takimi(seciliRakip);
                                    setEkran('zorluk_secimi');
                                }
                            }} 
                            disabled={!seciliRakip} 
                            className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg text-lg font-bold disabled:bg-slate-600 disabled:cursor-not-allowed">
                            Devam Et
                         </button>
                    </div>
                </div>
            );
             case 'zorluk_secimi': return (
                <div className="w-full max-w-md bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col gap-3">
                    <h2 className="text-3xl font-bold mb-2 text-center">Zorluk Seç</h2>
                    {DIFFICULTY_LEVELS.map(level => (
                        <button key={level.id} onClick={() => {
                            setZorluk(level.id);
                            maciBaslat(oyuncu1Takimi, oyuncu2Takimi, true);
                        }} className={`w-full px-6 py-3 rounded-lg text-lg font-bold transition-all duration-200 ${zorluk === level.id ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}>{level.label}</button>
                    ))}
                     <button onClick={() => setEkran(secimAmaci === 'hizli' ? 'rakip_secimi' : 'takim_secimi')} className="mt-4 w-full px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg text-lg font-bold">Geri</button>
                </div>
            );
            case 'oyun': 
                if (!aktifMac) return null;
                const oyuncuRaketiTakimi = oyuncu1Takimi;
                const rakipRaketiTakimi = aktifMac.team1.abbr === oyuncu1Takimi.abbr ? aktifMac.team2 : aktifMac.team1;

                return (
                <div className="w-full max-w-sm relative">
                   {gecisEkraniOlustur()}
                   <div className="flex justify-between items-center p-3 bg-slate-900/70 rounded-t-lg border-b-2 border-slate-700/50">
                       <div className="flex items-center gap-2 font-bold text-lg">
                           <div className="w-7 h-7 rounded-full border-2 border-slate-500" style={{ background: `linear-gradient(to right, ${aktifMac.team1.color1} 50%, ${aktifMac.team1.color2} 50%)` }}></div>
                           <span>{aktifMac.team1.abbr}</span>
                       </div>
                       <div className="text-center">
                            <span className={`text-4xl font-extrabold tracking-wider ${gecisEkrani === 'mac_sonucu' ? 'animate-score-pop' : ''}`}>{isPlayerTeam1 ? skor.player1 : skor.player2} - {isPlayerTeam1 ? skor.player2 : skor.player1}</span>
                            <div className="text-xl font-bold text-yellow-400">{Math.floor(oyunSuresi)}'</div>
                       </div>
                        <div className="flex items-center gap-2 font-bold text-lg">
                           <span>{aktifMac.team2.abbr}</span>
                           <div className="w-7 h-7 rounded-full border-2 border-slate-500" style={{ background: `linear-gradient(to right, ${aktifMac.team2.color1} 50%, ${aktifMac.team2.color2} 50%)` }}></div>
                       </div>
                   </div>
                   <OyunAlani
                        player1Team={oyuncuRaketiTakimi}
                        player2Team={rakipRaketiTakimi}
                        isOpponentAI={rakipYapayZeka}
                        difficulty={zorluk}
                        isPaused={duraklatildi}
                        onGoal={handleGoal}
                        triggerReset={sifirlamaTetikleyici}
                        controlSplitRatio={0.5}
                    />
                     <div className="flex justify-center p-2 bg-slate-900/70 rounded-b-lg gap-4">
                       <button onClick={() => { setDuraklatildi(true); setGecisEkrani('duraklatildi'); }} className="px-5 py-2 bg-yellow-600/80 hover:bg-yellow-500 rounded-lg font-bold" disabled={duraklatildi || gecisEkrani === 'mac_sonucu'}>Duraklat</button>
                    </div>
                </div>
            );
             case 'lig_merkezi': if (!lig) return null; return (
                <div className="w-full max-w-4xl flex flex-col items-center gap-6">
                    <h2 className="text-4xl font-extrabold">Lig Modu</h2>
                    <LigTablosu table={lig.table} playerTeam={oyuncu1Takimi} />
                    {siradakiLigMaci && (
                        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                            <h3 className="text-xl font-bold mb-2">{lig.currentWeek + 1}. Hafta Maçı</h3>
                            <p className="text-lg">{siradakiLigMaci.team1.abbr} vs {siradakiLigMaci.team2.abbr}</p>
                            <button onClick={() => maciBaslat(siradakiLigMaci.team1, siradakiLigMaci.team2, true)} className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold">Maça Başla</button>
                        </div>
                    )}
                    {lig.currentWeek >= (TEAMS.length-1) * 2 && <p className="text-2xl font-bold text-yellow-400">Lig Bitti!</p>}
                    <button onClick={() => setEkran('menu')} className="mt-4 px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg font-bold">Ana Menü</button>
                </div>
             );
            case 'turnuva_merkezi': if (!turnuva) return null; 
                const isWinner = turnuva.winner && turnuva.winner.abbr === oyuncu1Takimi.abbr;
                const isLoser = turnuva.winner && turnuva.winner.abbr !== oyuncu1Takimi.abbr;
                const isEliminated = !siradakiTurnuvaMaci && !turnuva.winner;
            return (
                <div className="w-full max-w-6xl flex flex-col items-center gap-6">
                    <h2 className="text-4xl font-extrabold">Turnuva Modu</h2>
                    <TurnuvaFiksturu tournament={turnuva} />
                    {siradakiTurnuvaMaci && !turnuva.winner && (
                        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-center">
                             <h3 className="text-xl font-bold mb-2">Sıradaki Maç</h3>
                            <p className="text-lg">{siradakiTurnuvaMaci.team1?.abbr} vs {siradakiTurnuvaMaci.team2?.abbr}</p>
                            <button onClick={() => maciBaslat(siradakiTurnuvaMaci.team1!, siradakiTurnuvaMaci.team2!, true)} className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold">Maça Başla</button>
                        </div>
                    )}
                    {isWinner && <p className="text-3xl font-bold text-yellow-400 animate-pulse">TURNUVAYI KAZANDIN!</p>}
                    {isLoser && <p className="text-2xl font-bold text-red-500">Turnuvayı Kaybettin!</p>}
                    {isEliminated && <p className="text-2xl font-bold text-red-500">Turnuvadan Elendin!</p>}
                    <button onClick={() => setEkran('menu')} className="mt-4 px-6 py-3 bg-red-700/80 hover:bg-red-600 rounded-lg font-bold">Ana Menü</button>
                </div>
            );
            case 'penalti_atis': if(!aktifMac) return null; return (
                <PenaltiAtislari 
                    playerTeam={isPlayerTeam1 ? aktifMac.team1 : aktifMac.team2}
                    aiTeam={isPlayerTeam1 ? aktifMac.team2 : aktifMac.team1}
                    difficulty={zorluk}
                    onFinish={penaltiBitti}
                />
            );
            default: return <div>Bilinmeyen Ekran</div>;
        }
    };

    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
            {ekranOlustur()}
        </div>
    );
};

export default Uygulama;