import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MCKINNEY_HOME_PREVIEWS } from "../puzzles/engine";
import { NINE_BUILDINGS } from "../simulations/catalog";
import { CUSTOM_BOARD_KEY, type CustomBoard } from "../../boards/boardStorage";

type LocalGame="hidden-maze"|"i-spy"|"bingo"|"tic-tac-toe";
type Mark="X"|"O"|null;
const C={bg:"#F8F5EC",card:"#FFF",ink:"#17241D",muted:"#627067",green:"#275D45",gold:"#E0A43A",line:"#DCD8CF",pale:"#E3ECE6",red:"#A33D32",blue:"#426A9B"};
const GAMES=[
 {id:"saboteur",title:"Signal Saboteur",players:"2 phones",description:"Investigate, stabilize, sabotage, and accuse through a synchronized room."},
 {id:"square-three",title:"Square Three",players:"1–2 players",description:"Visit downtown clues and solve the compact location Sudoku."},
 {id:"hidden-maze",title:"Hidden Sidewalk Maze",players:"1–2 players",description:"Solve turns as a route unfolds around several downtown blocks."},
 {id:"i-spy",title:"Downtown I Spy",players:"1–4 players",description:"Use sourced clues to identify permanent details and landmarks."},
 {id:"encrypted-hunt",title:"Encrypted Hunt",players:"2 phones",description:"Leave a message at a hub, share a code, and solve to decrypt it."},
 {id:"bingo",title:"Downtown Bingo",players:"1–4 players",description:"Complete observations across the nine blocks and make a line."},
 {id:"tic-tac-toe",title:"Building Tic-Tac-Toe",players:"2 players",description:"Alternate block challenges to claim X or O and make three in a row."},
] as const;

export default function McKinneyPuzzleLabScreen(){
 const router=useRouter(); const [local,setLocal]=useState<LocalGame|null>(null),[boardNames,setBoardNames]=useState<string[]>(NINE_BUILDINGS);
 useFocusEffect(useCallback(()=>{void AsyncStorage.getItem(CUSTOM_BOARD_KEY).then(raw=>{if(!raw)return;try{const board=JSON.parse(raw) as CustomBoard;if(board.names?.length===9)setBoardNames(board.names)}catch{}})},[]));
 function open(id:string){if(id==="saboteur")router.push("/signal-saboteur-multiplayer");else if(id==="square-three")router.push("/mckinney-grid");else if(id==="encrypted-hunt")router.push("/message-hunt");else setLocal(id as LocalGame)}
 if(local)return <LocalGameScreen game={local} names={boardNames} close={()=>setLocal(null)}/>;
 return <SafeAreaView style={s.safe} edges={["bottom"]}><ScrollView contentContainerStyle={s.content}>
  <Text style={s.eye}>DOWNTOWN MCKINNEY · FIELD BUILD</Text><Text style={s.title}>Choose a game</Text><Text style={s.intro}>These are the playable versions. Every game uses the same nine numbered blocks; Simulation Lab remains the place to study how each mechanic works.</Text>
  <View style={s.modeRow}><Pressable onPress={()=>router.push("/mckinney-simulation-lab")} style={s.modeOff}><Text style={s.modeOffTitle}>SIMULATE</Text><Text style={s.modeOffText}>Review rules and steps</Text></Pressable><View style={s.modeOn}><Text style={s.modeOnTitle}>PLAY</Text><Text style={s.modeOnText}>Start a field game</Text></View></View>
  <Pressable onPress={()=>router.push("/board-builder")} style={s.builder}><Text style={s.builderTitle}>Create a nine-block board anywhere</Text><Text style={s.builderText}>Choose a center, resize the grid, and name all nine cells</Text></Pressable>
  <Pressable onPress={()=>router.push("/nine-portals")} style={s.builder}><Text style={s.builderTitle}>Open the nine portals</Text><Text style={s.builderText}>Test an animated signal at every downtown block</Text></Pressable>
  <View style={s.gameList}>{GAMES.map((game,index)=><Pressable key={game.id} onPress={()=>open(game.id)} style={s.gameCard}><View style={s.gameNumber}><Text style={s.gameNumberText}>{index+1}</Text></View><View style={s.gameCopy}><Text style={s.gameTitle}>{game.title}</Text><Text style={s.players}>{game.players}</Text><Text style={s.description}>{game.description}</Text></View><Text style={s.arrow}>›</Text></Pressable>)}</View>
  <Text style={s.safety}>Field test rule: remain on public sidewalks, use marked crossings, and never play while driving.</Text>
 </ScrollView></SafeAreaView>
}

function LocalGameScreen({game,names,close}:{game:LocalGame;names:string[];close:()=>void}){
 return <SafeAreaView style={s.safe} edges={["bottom"]}><ScrollView contentContainerStyle={s.content}><Pressable onPress={close}><Text style={s.back}>‹ ALL GAMES</Text></Pressable>{game==="hidden-maze"?<HiddenMaze names={names}/>:game==="i-spy"?<ISpy names={names}/>:game==="bingo"?<Bingo names={names}/>:<TicTacToe names={names}/>}</ScrollView></SafeAreaView>
}

const MAZES=[
 ["North","East","East","South","East","South","West"],
 ["West","North","North","East","South","East","North"],
 ["East","South","East","North","North","West","North"],
 ["South","West","South","East","East","North","East"],
];
function HiddenMaze({names}:{names:string[]}){
 const [seed,setSeed]=useState(0),[step,setStep]=useState(0),[message,setMessage]=useState("Solve the first turn to reveal the route."); const route=MAZES[seed%MAZES.length], expected=route[step];
 const wrong=expected==="North"?"West":expected==="South"?"East":expected==="East"?"North":"South"; const options=seed%2?[wrong,expected]:[expected,wrong]; const done=step>=route.length;
 function answer(value:string){if(value!==expected){setMessage("That turn closes the path. Try the other safe sidewalk direction.");return}const next=step+1;setStep(next);setMessage(next===route.length?"Maze complete. You navigated around three downtown blocks.":"Correct. The next sidewalk segment is now visible.")}
 return <><Text style={s.eye}>PLAYABLE FIELD PROTOTYPE</Text><Text style={s.title}>Hidden Sidewalk Maze</Text><Text style={s.intro}>Start beside the center cell. Each answer reveals one sidewalk turn; do not enter a block or cross outside a marked crossing.</Text><BlockStrip names={names} active={Math.min(step,8)} solved={Math.min(step,8)}/><View style={s.progress}><Text style={s.progressText}>{done?"ROUTE COMPLETE":`TURN ${step+1} OF ${route.length}`}</Text><Text style={s.route}>{route.slice(0,step).join(" → ")||"CENTER START"}</Text></View><View style={s.challenge}><Text style={s.challengeLabel}>STREET DECISION</Text><Text style={s.prompt}>{done?"You have returned to the final signal zone.":`The clue at ${names[Math.min(step+4,8)]} opens one direction. Which turn continues the hidden route?`}</Text>{!done?<View style={s.choiceRow}>{options.map(x=><Pressable key={x} onPress={()=>answer(x)} style={s.choice}><Text style={s.choiceText}>{x}</Text></Pressable>)}</View>:null}<Text style={s.feedback}>{message}</Text></View><Pressable onPress={()=>{setSeed(v=>v+1);setStep(0);setMessage("A new multi-block route is ready.")}} style={s.primary}><Text style={s.primaryText}>Generate another maze</Text></Pressable></>
}

function ISpy({names}:{names:string[]}){
 const preview=MCKINNEY_HOME_PREVIEWS["i-spy"],[round,setRound]=useState(0),[choice,setChoice]=useState<string|null>(null); const choices=rotate(preview.choices??[],round); const correct=choice===preview.answer;
 return <><Text style={s.eye}>PLAYABLE FIELD PROTOTYPE</Text><Text style={s.title}>Downtown I Spy</Text><Text style={s.intro}>Observe only permanent details visible from public sidewalks. The first sourced round is ready for field verification tonight.</Text><BlockStrip names={names} active={round%9}/><View style={s.challenge}><Text style={s.challengeLabel}>{names[round%9].toUpperCase()} · OBSERVATION</Text><Text style={s.scene}>{preview.scene}</Text><Text style={s.prompt}>{preview.prompt}</Text><View style={s.stack}>{choices.map(x=><Pressable disabled={choice!==null} key={x} onPress={()=>setChoice(x)} style={[s.choiceWide,choice===x&&(correct?s.correct:s.incorrect)]}><Text style={[s.choiceText,choice===x&&s.choiceTextOn]}>{x}</Text></Pressable>)}</View>{choice?<Text style={s.feedback}>{correct?"Correct. ":"Not quite. "}{preview.explanation}</Text>:null}</View><Pressable onPress={()=>{setRound(v=>v+1);setChoice(null)}} style={s.primary}><Text style={s.primaryText}>Generate next I Spy round</Text></Pressable></>
}

const BINGO_TASKS=["Find a date on a public marker","Spot decorative brickwork","Find a permanent civic symbol","Identify an upper-story window pattern","Reach the MPAC sidewalk","Find a historic business sign","Spot a public art detail","Find an accessible crossing","Identify a reused historic building"];
function Bingo({names}:{names:string[]}){
 const [photos,setPhotos]=useState<(string|null)[]>(Array(9).fill(null)),[selected,setSelected]=useState<number|null>(null),[cameraError,setCameraError]=useState(""); const marked=photos.map(Boolean),line=winningLine(marked);
 async function capture(index:number){
  if(photos[index]){setSelected(index);return}
  const permission=await ImagePicker.requestCameraPermissionsAsync();
  if(!permission.granted){setCameraError("Camera permission is required for a Bingo hit.");return}
  const result=await ImagePicker.launchCameraAsync({mediaTypes:["images"],quality:.65,allowsEditing:false});
  if(result.canceled||!result.assets[0]?.uri)return;
  setPhotos(current=>current.map((photo,i)=>i===index?result.assets[0].uri:photo));setSelected(index);setCameraError("");
 }
 return <><Text style={s.eye}>PHOTO-VERIFIED FIELD PROTOTYPE</Text><Text style={s.title}>Downtown Bingo</Text><Text style={s.intro}>Tap an unfinished square to open the camera. A square only counts after a photo is captured; tap a completed square to review its evidence.</Text><View style={s.board}>{BINGO_TASKS.map((task,i)=><Pressable key={task} onPress={()=>void capture(i)} style={[s.boardCell,marked[i]&&s.boardDone,line.includes(i)&&s.boardWin]}>{photos[i]?<Image source={{uri:photos[i]!}} style={{borderRadius:7,height:42,marginBottom:3,width:"100%"}}/>:<Text style={s.boardNum}>{i+1} · TAKE PHOTO</Text>}<Text style={[s.boardText,marked[i]&&s.boardTextOn]}>{names[i]}</Text><Text style={[s.boardTask,marked[i]&&s.boardTextOn]}>{task}</Text></Pressable>)}</View>{cameraError?<Text style={[s.feedback,{color:C.red}]}>{cameraError}</Text>:null}{selected!==null&&photos[selected]?<View style={s.challenge}><Text style={s.challengeLabel}>PHOTO EVIDENCE · CELL {selected+1}</Text><Image source={{uri:photos[selected]!}} style={{borderRadius:11,height:210,marginTop:10,width:"100%"}}/><Text style={s.feedback}>{BINGO_TASKS[selected]}</Text></View>:null}<Text style={s.feedback}>{line.length?"Bingo — three photo-backed discoveries form a line.":`${marked.filter(Boolean).length}/9 photo-backed observations`}</Text><Pressable onPress={()=>{setPhotos(Array(9).fill(null));setSelected(null);setCameraError("")}} style={s.primary}><Text style={s.primaryText}>Reset bingo card</Text></Pressable></>
}

function TicTacToe({names}:{names:string[]}){
 const [cells,setCells]=useState<Mark[]>(Array(9).fill(null)),[turn,setTurn]=useState<"X"|"O">("X"); const win=winner(cells),full=cells.every(Boolean);
 function claim(i:number){if(cells[i]||win)return;const next=cells.map((x,n)=>n===i?turn:x);setCells(next);if(!winner(next))setTurn(turn==="X"?"O":"X")}
 return <><Text style={s.eye}>PLAYABLE FIELD PROTOTYPE</Text><Text style={s.title}>Building Tic-Tac-Toe</Text><Text style={s.intro}>Players alternate. Complete the block’s agreed observation or clue, then tap it to claim X or O.</Text><View style={s.board}>{cells.map((mark,i)=><Pressable key={i} onPress={()=>claim(i)} style={[s.tttCell,mark==="X"&&s.xCell,mark==="O"&&s.oCell,win?.line.includes(i)&&s.boardWin]}><Text style={s.boardNum}>{i+1}</Text><Text style={s.tttMark}>{mark??"·"}</Text><Text style={[s.boardText,mark&&s.boardTextOn]}>{names[i]}</Text></Pressable>)}</View><Text style={s.feedback}>{win?`Player ${win.mark} wins the downtown line.`:full?"Draw — reset for another route.":`Player ${turn}: complete a block challenge, then claim it.`}</Text><Pressable onPress={()=>{setCells(Array(9).fill(null));setTurn("X")}} style={s.primary}><Text style={s.primaryText}>New game</Text></Pressable></>
}

function BlockStrip({names,active,solved=0}:{names:string[];active:number;solved?:number}){return <View style={s.strip}>{names.map((_,i)=><View key={i} style={[s.stripCell,i<solved&&s.stripSolved,i===active&&s.stripActive]}><Text style={s.stripText}>{i+1}</Text></View>)}</View>}
function rotate<T>(items:T[],seed:number){if(!items.length)return items;const n=Math.abs(seed)%items.length;return [...items.slice(n),...items.slice(0,n)]}
const LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winningLine(marked:boolean[]){return LINES.find(line=>line.every(i=>marked[i]))??[]}
function winner(cells:Mark[]){const line=LINES.find(row=>cells[row[0]]&&row.every(i=>cells[i]===cells[row[0]]));return line?{mark:cells[line[0]],line}:null}

const s=StyleSheet.create({safe:{backgroundColor:C.bg,flex:1},content:{padding:20,paddingBottom:55},eye:{color:C.green,fontSize:10,fontWeight:"900",letterSpacing:1.3},title:{color:C.ink,fontSize:34,fontWeight:"900",marginTop:6},intro:{color:C.muted,fontSize:13,lineHeight:20,marginTop:8},back:{color:C.green,fontSize:11,fontWeight:"900",marginBottom:18},modeRow:{flexDirection:"row",gap:8,marginTop:17},modeOff:{backgroundColor:C.card,borderColor:C.line,borderRadius:14,borderWidth:1,flex:1,padding:12},modeOn:{backgroundColor:C.green,borderRadius:14,flex:1,padding:12},modeOffTitle:{color:C.green,fontSize:10,fontWeight:"900",letterSpacing:1},modeOnTitle:{color:"#FFF",fontSize:10,fontWeight:"900",letterSpacing:1},modeOffText:{color:C.muted,fontSize:10,marginTop:4},modeOnText:{color:"#D6E9DC",fontSize:10,marginTop:4},builder:{backgroundColor:"#FFF8E8",borderColor:"#E2C67D",borderRadius:13,borderWidth:1,marginTop:10,padding:13},builderTitle:{color:C.ink,fontSize:13,fontWeight:"900"},builderText:{color:C.muted,fontSize:10,marginTop:4},gameList:{gap:9,marginTop:12},gameCard:{alignItems:"center",backgroundColor:C.card,borderColor:C.line,borderRadius:15,borderWidth:1,flexDirection:"row",padding:14},gameNumber:{alignItems:"center",backgroundColor:C.pale,borderRadius:18,height:36,justifyContent:"center",width:36},gameNumberText:{color:C.green,fontWeight:"900"},gameCopy:{flex:1,marginLeft:11},gameTitle:{color:C.ink,fontSize:15,fontWeight:"900"},players:{color:C.gold,fontSize:8,fontWeight:"900",letterSpacing:.7,marginTop:3,textTransform:"uppercase"},description:{color:C.muted,fontSize:10,lineHeight:15,marginTop:5},arrow:{color:C.green,fontSize:28,fontWeight:"300"},safety:{color:C.red,fontSize:10,lineHeight:15,marginTop:16,textAlign:"center"},strip:{flexDirection:"row",gap:4,marginTop:17},stripCell:{alignItems:"center",backgroundColor:C.card,borderColor:C.line,borderRadius:7,borderWidth:1,flex:1,paddingVertical:8},stripSolved:{backgroundColor:C.pale},stripActive:{backgroundColor:C.gold,borderColor:C.gold},stripText:{color:C.ink,fontSize:9,fontWeight:"900"},progress:{backgroundColor:C.ink,borderRadius:14,marginTop:10,padding:14},progressText:{color:"#BCD1C3",fontSize:8,fontWeight:"900",letterSpacing:1},route:{color:"#FFF",fontSize:12,fontWeight:"800",lineHeight:18,marginTop:6},challenge:{backgroundColor:C.card,borderColor:C.line,borderRadius:17,borderWidth:1,marginTop:12,padding:16},challengeLabel:{color:C.gold,fontSize:8,fontWeight:"900",letterSpacing:1},scene:{color:C.muted,fontSize:11,fontStyle:"italic",lineHeight:17,marginTop:9},prompt:{color:C.ink,fontSize:17,fontWeight:"800",lineHeight:24,marginTop:9},choiceRow:{flexDirection:"row",gap:8,marginTop:14},choice:{alignItems:"center",borderColor:C.green,borderRadius:12,borderWidth:1,flex:1,padding:13},choiceWide:{backgroundColor:C.bg,borderColor:C.line,borderRadius:11,borderWidth:1,padding:12},choiceText:{color:C.green,fontSize:12,fontWeight:"900"},choiceTextOn:{color:"#FFF"},stack:{gap:8,marginTop:14},correct:{backgroundColor:C.green,borderColor:C.green},incorrect:{backgroundColor:C.red,borderColor:C.red},feedback:{color:C.muted,fontSize:11,fontWeight:"700",lineHeight:17,marginTop:13,textAlign:"center"},primary:{alignItems:"center",backgroundColor:C.green,borderRadius:13,marginTop:12,padding:14},primaryText:{color:"#FFF",fontSize:12,fontWeight:"900"},board:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:18},boardCell:{backgroundColor:C.card,borderColor:C.line,borderRadius:11,borderWidth:1,height:126,padding:8,width:"31.7%"},boardDone:{backgroundColor:C.green},boardWin:{borderColor:C.gold,borderWidth:3},boardNum:{color:C.gold,fontSize:8,fontWeight:"900"},boardText:{color:C.ink,fontSize:9,fontWeight:"900",marginTop:5},boardTask:{color:C.muted,fontSize:8,lineHeight:11,marginTop:6},boardTextOn:{color:"#FFF"},tttCell:{alignItems:"center",backgroundColor:C.card,borderColor:C.line,borderRadius:11,borderWidth:1,height:112,justifyContent:"center",padding:6,width:"31.7%"},xCell:{backgroundColor:C.red},oCell:{backgroundColor:C.blue},tttMark:{color:"#FFF",fontSize:29,fontWeight:"900",lineHeight:32}});
