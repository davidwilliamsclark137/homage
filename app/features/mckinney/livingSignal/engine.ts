export type NodeState="dormant"|"available"|"stable"|"corrupted";
export type PortalRule="source"|"mirror"|"gate"|"relay"|"source"|"corruptor"|"recorder"|"splitter"|"sink";
export type LivingSignalGame={mission:number;move:number;current:number;states:NodeState[];edges:string[];revealed:boolean[];status:"playing"|"won"|"lost";message:string};

export const ADJACENCY=[[1,3],[0,2,4],[1,5],[0,4,6],[1,3,5,7],[2,4,8],[3,7],[4,6,8],[5,7]];
export const RULES:PortalRule[]=["source","mirror","gate","relay","source","corruptor","recorder","splitter","sink"];
export const MISSIONS=[
 {path:[4,3,6],name:"Western Memory",payload:"THE CITY REMEMBERS EVERY PATH."},
 {path:[4,1,0],name:"Northern Echo",payload:"A SIGNAL BECOMES REAL WHEN IT IS SHARED."},
 {path:[4,5,2],name:"Eastern Fold",payload:"THE MAP IS ALSO A MACHINE."},
 {path:[4,7,8],name:"Southern Bloom",payload:"EVERY ENDING LEAVES ANOTHER ENTRANCE."},
];
export const MAX_MOVES=6;

export function newLivingSignalGame(mission=0):LivingSignalGame{const states:NodeState[]=Array(9).fill("dormant");states[4]="stable";for(const n of ADJACENCY[4])states[n]="available";return{mission:mission%MISSIONS.length,move:0,current:4,states,edges:[],revealed:Array(9).fill(false).map((_,i)=>i===4),status:"playing",message:"MPAC is awake. Choose an adjacent signal."}}
export function edgeKey(a:number,b:number){return a<b?`${a}-${b}`:`${b}-${a}`}
export function tuningAnswer(node:number,move:number){return(node*2+move)%3}
export function activate(game:LivingSignalGame,node:number,choice:number):LivingSignalGame{
 if(game.status!=="playing"||!ADJACENCY[game.current].includes(node))return game;
 const move=game.move+1,states=[...game.states],revealed=[...game.revealed],edges=[...game.edges];revealed[node]=true;
 if(choice!==tuningAnswer(node,game.move)){states[node]="corrupted";return finish({...game,move,states,revealed,edges,message:`Portal ${node+1} fractured. Its pattern can be tuned again.`})}
 states[node]="stable";const key=edgeKey(game.current,node);if(!edges.includes(key))edges.push(key);
 for(const neighbor of ADJACENCY[node])if(states[neighbor]==="dormant")states[neighbor]="available";
 const rule=RULES[node];
 if(rule==="splitter")for(const neighbor of ADJACENCY[node])if(states[neighbor]!=="stable")states[neighbor]="available";
 if(rule==="corruptor"){const victim=ADJACENCY[node].find(n=>states[n]==="available");if(victim!==undefined)states[victim]="corrupted"}
 return finish({...game,move,current:node,states,revealed,edges,message:`Portal ${node+1} stabilized. ${rule.toUpperCase()} rule revealed.`});
}
function finish(game:LivingSignalGame):LivingSignalGame{
 const mission=MISSIONS[game.mission];
 const connected=mission.path.slice(1).every((node,i)=>game.states[node]==="stable"&&game.edges.includes(edgeKey(mission.path[i],node)));
 if(connected)return{...game,status:"won",message:"The target graph is stable. Its encrypted payload is opening."};
 if(game.move>=MAX_MOVES)return{...game,status:"lost",message:"The signal collapsed after six moves. Generate a new network and try again."};
 if(game.move>0&&game.move%2===0){
  const victim=game.states.findIndex((state,i)=>state==="available"&&!mission.path.includes(i));
  if(victim>=0){const states=[...game.states];states[victim]="corrupted";return{...game,states,message:`${game.message} The Ghost fractured portal ${victim+1}.`}}
 }
 return game;
}
