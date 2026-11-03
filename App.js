import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { makeSession, view, award } from './quiz.mjs';

const sample = 'Evaporation turns liquid water into vapor. Condensation turns vapor back into liquid water.';
const warmup = [
  {type:'choice',prompt:'What turns liquid water into vapor?',options:['Freezing','Evaporation','Condensation','Melting'],answer:'Evaporation',quote:'Evaporation turns liquid water into vapor.',explanation:'Sa evaporation, ang tubig ay nagiging singaw.',bisaya:'Sa evaporation, ang tubig mahimong alisngaw.'},
  {type:'typed',prompt:'Give the English term for vapor turning back into liquid water.',answer:'Condensation',quote:'Condensation turns vapor back into liquid water.',explanation:'Condensation ang tawag kapag naging likido ulit ang singaw.',bisaya:'Condensation ang tawag kon ang alisngaw mahimong likido pag-usab.'},
];

const api = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8787';
const green = '#cdff63', paper = '#f4f3e9', ink = '#181d1a';
const voices = {
  Tagalog: {
    win: ['Tama! May resibo ang sagot mo.', 'Ayos, kabisado mo ’to!', 'Galing! Pasok na pasok.'],
    miss: ['Putangina, saan mo hinugot ’yan?', 'Bobo ng hula, basahin mo ’yung ebidensya.', 'Tarantado, nag-imbento ka na naman!'],
  },
  Bisaya: {
    win: ['Sakto kaayo! Kabalo gyud ka.', 'Maayo! Nakuha nimo.', 'Payter, sakto imong tubag!'],
    miss: ['Piste, asa man nimo gipunit nang tubaga?', 'Yawa, layoa sa imong tubag uy!', 'Ataya, basaha balik ang notes!'],
  },
};
async function post(path, body) {
  let r;
  try { r = await fetch(api + path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
  catch { throw Error('Cannot reach the quiz server. Check its address and connection.'); }
  const data = await r.json();
  if (!r.ok) throw Object.assign(Error(data.error || 'Request failed.'),{status:r.status});
  return data;
}
async function readAsset(asset) {
  if (Platform.OS !== 'web') return new File(asset.uri).base64();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(Error('File could not be read.'));
    reader.readAsDataURL(asset.file);
  });
}
function Button({children,onPress,disabled,secondary}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({pressed})=>[styles.button,secondary && styles.secondary,{opacity:disabled ? .45 : pressed ? .75 : 1}]}>
    <Text style={[styles.buttonLabel,secondary && {color:paper}]}>{children}</Text></Pressable>;
}
function Label({children}) {return <Text style={styles.label}>{children}</Text>;}
export default function App() {
  return <SafeAreaProvider><Game/></SafeAreaProvider>;
}
const storageKey = 'recall-riot:session:' + api;
function Game() {
  const [asset,setAsset] = useState(null), [game,setGame] = useState(null), [token,setToken] = useState('');
  const [feedback,setFeedback] = useState(null), [answer,setAnswer] = useState(''), [voice,setVoice] = useState('Tagalog');
  const [busy,setBusy] = useState(''), [error,setError] = useState('');
  const [saved,setSaved] = useState(''), [runName,setRunName] = useState('');
  const practice = useRef(null);
  function startPractice() {
    practice.current = makeSession(warmup,sample);
    setRunName('Water cycle · Practice'); setFeedback(null); setAnswer(''); setError('');
    setGame(view(practice.current));
  }
  const [setup,setSetup] = useState('Checking quiz server…'), [checks,setChecks] = useState(0);
  useEffect(()=>{
    let active = true;
    setSetup('Checking quiz server…');
    post('/status',{}).then(({configured})=>{
      if (active) setSetup(configured ? '' : 'Quiz setup needed. Set AI_API_KEY in the server .env file and restart the server.');
    }).catch(e=>{if(active) setSetup(e.message);});
    return ()=>{active=false;};
  },[checks]);
  useEffect(()=>{AsyncStorage.getItem(storageKey).then(value=>setSaved(value || '')).catch(()=>{});},[]);
  function remember(value) {
    setSaved(value);
    const update = value ? AsyncStorage.setItem(storageKey,value) : AsyncStorage.removeItem(storageKey);
    update.catch(()=>{});
  }
  async function perform(message,fn) {
    if (busy) return;
    setBusy(message); setError('');
    try { await fn(); }
    catch(e) {
      if (game && e.status === 404) reset();
      setError(e.message);
    } finally { setBusy(''); }
  }
  function pick() { perform('Opening files…',async()=>{
    const r = await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true});
    if (!r.canceled) {
      const file = r.assets[0];
      if (!/\.(pdf|docx|txt|md)$/i.test(file.name) || file.size > 3*1024*1024) throw Error('Choose PDF, DOCX, TXT or MD, up to 3 MB.');
      setAsset(file);
    }
  }); }
  function start() { perform('Reading notes and writing questions…',async()=>{
    const result = await post('/quiz',{name:asset.name,voice,data:await readAsset(asset)});
    setToken(result.token); remember(result.token); setRunName(asset.name); setGame(result); setFeedback(null); setAnswer('');
  }); }
  function resume() { perform('Restoring run…',async()=>{
    let result;
    try { result = await post('/resume',{token:saved}); }
    catch(e) { if(e.status===404) remember(''); throw e; }
    setToken(saved); setRunName(result.name); setVoice(result.voice);
    setGame(result); setFeedback(result.feedback || null); setAnswer('');
  }); }
  function submit() { perform('Checking your recall…',async()=>{
    if (practice.current) {
      const session = practice.current;
      const question = session.questions[session.index];
      const correct = answer.trim().toLowerCase() === question.answer.toLowerCase();
      award(session,correct);
      setGame(view(session)); setAnswer('');
      setFeedback({...question,correct,submitted:answer,explanation:voice==='Bisaya' ? question.bisaya : question.explanation});
      return;
    }
    const result = await post('/answer',{token,id:game.question.id,answer});
    setGame(result); setFeedback({...result.feedback,submitted:answer}); setAnswer('');
  }); }
  function buy() {
    if (practice.current) {
      const session = practice.current;
      if (session.coins >= 20 && session.index < session.questions.length) {
        session.coins -= 20; session.lives++; setGame(view(session));
      }
      return;
    }
    perform('Trading coins…',async()=>setGame(await post('/life',{token,coins:game.coins,lives:game.lives})));
  }
  function reset() {if (!practice.current) remember(''); practice.current=null;setGame(null);setFeedback(null);setAnswer('');setError('');}
  const q = game?.question;
  const lines = feedback && voices[voice][feedback.correct ? 'win' : 'miss'];
  return <SafeAreaView style={styles.root}><StatusBar barStyle="light-content" backgroundColor={ink}/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.wrap}>
        <View style={styles.brand}><Text style={styles.mark}>RR</Text><Text style={styles.brandText}>RECALL RIOT</Text></View>
        {!game ? <>
          <Label>01  /  TRAINING ROOM</Label>
          <Text style={styles.title}>Notes mo.{'\n'}<Text style={{color:green}}>Sagot mo.</Text></Text>
          <Text style={styles.copy}>Turn your study file into a recall run. Tama? May coins. Mali? May resibo at trashtalk.</Text>
          {!!saved && <Button secondary disabled={!!busy} onPress={resume}>Resume last run  →</Button>}
          <Label>BOT LANGUAGE</Label>
          <View style={styles.row}>{Object.keys(voices).map(v=><Button key={v} secondary={voice!==v} disabled={!!busy} onPress={()=>setVoice(v)}>{v}</Button>)}</View>
          <View style={[styles.card,{backgroundColor:'#293520',borderColor:'#657d42'}]}>
            <Label>WARM-UP  /  WATER CYCLE</Label>
            <Text style={styles.heading}>Try a practice round</Text>
            <Text style={styles.copy}>Memorize these two lines. They disappear when you start. This sample plays on your device.</Text>
            <Text style={styles.quote}>{sample}</Text>
            <Button disabled={!!busy} onPress={startPractice}>Play 2 questions  →</Button>
          </View>
          {!!setup && <View style={styles.card} accessibilityLiveRegion="polite"><Text style={styles.copy}>{setup}</Text>
            <Button secondary onPress={()=>setChecks(value=>value+1)}>Check connection again</Button></View>}
          <View style={styles.card}><Label>STUDY MATERIAL</Label>
            <Text style={styles.heading}>{asset?.name || 'Bring your reviewer'}</Text>
            <Text style={styles.copy}>PDF, DOCX, TXT or Markdown · up to 3 MB</Text>
            <Button secondary disabled={!!busy || !!setup} onPress={pick}>{asset ? 'Change file' : '+  Choose file'}</Button>
          </View>
          <Text style={styles.copy}>Uncensored roast mode. Starting sends your notes to the configured AI provider.</Text>
          <Button onPress={start} disabled={!asset || !!busy || !!setup}>Start recall run  →</Button>
        </> : <>
          <Label>{runName}</Label>
          {!!practice.current && <Button secondary onPress={reset}>Exit practice</Button>}
          <View style={styles.row}><Text style={styles.stat}>♥  {game.lives} lives</Text><Text style={styles.stat}>●  {game.coins} coins</Text></View>
          <View style={styles.track}><View style={{height:6,width:(100*game.index/game.total)+'%',backgroundColor:green}}/></View>
          {feedback ? <View style={styles.card} accessibilityLiveRegion="polite">
            <Label>{feedback.correct ? 'CORRECT  /  +10 COINS' : 'MISS  /  −1 LIFE'}</Label>
            <Text style={[styles.heading,{color:feedback.correct?green:'#ffa28a'}]}>{lines[(game.index-1)%lines.length]}</Text>
            {!!feedback.prompt && <Text style={styles.answer}>{feedback.prompt}</Text>}
            <Text style={styles.copy}>Your answer · {feedback.submitted}</Text>
            <Text style={styles.heading}>{feedback.answer}</Text><Text style={styles.copy}>{feedback.explanation}</Text>
            <Label>FROM YOUR NOTES{feedback.location ? '  /  '+feedback.location : ''}</Label><Text style={styles.quote}>“{feedback.quote}”</Text>
            <Button disabled={!!busy} onPress={()=>setFeedback(null)}>{q ? 'Next question  →' : 'View results  →'}</Button>
          </View> : q ? <View style={styles.card}>
            <Label>{q.review ? 'RECALL RETRY' : 'QUESTION'} {game.index+1} / {game.total}   ·   {q.type==='choice'?'PICK ONE':'WRITE IT'}</Label>
            <Text style={styles.heading}>{q.prompt}</Text>
            {q.type==='choice' ? q.options.map((item,i)=><Button key={item} secondary={answer!==item} disabled={!!busy} onPress={()=>setAnswer(item)}>{String.fromCharCode(65+i)}   {item}</Button>) :
              <TextInput accessibilityLabel="Your answer" multiline maxLength={2000} editable={!busy} placeholder="Ano ang sagot mo?" placeholderTextColor="#aaa" style={styles.input} value={answer} onChangeText={setAnswer}/>}
            <Button disabled={!answer.trim() || !!busy} onPress={submit}>Lock in answer  →</Button>
          </View> : <View style={styles.card}><Label>RUN REPORT</Label>
            <Text style={styles.heading}>{game.lives ? 'Run complete.' : 'Out of lives.'}</Text>
            <Text style={styles.copy}>{game.correct} correct · {game.index} answered · {game.total} questions</Text>
            {game.reviewNotes?.map((note,i)=><View style={styles.reviewNote} key={i}>
              <Label>{note.recovered ? 'RECALLED ON RETRY' : 'PRACTICE AGAIN'}</Label>
              <Text style={styles.copy}>{note.prompt}</Text>
              <Text style={styles.answer}>{note.answer}</Text>
              <Text style={styles.quote}>“{note.quote}”{note.location ? ' · '+note.location : ''}</Text>
            </View>)}
            <Button disabled={!!busy} onPress={reset}>Start another run</Button>
          </View>}
          {game.index<game.total && <Button secondary disabled={game.coins<20 || !!busy} onPress={buy}>+1 life  /  20 coins</Button>}
        </>}
        {!!busy && <View style={styles.row}><ActivityIndicator color={green}/><Text style={styles.copy}>{busy}</Text></View>}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View>
    </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:ink},scroll:{alignItems:'center',paddingHorizontal:20,paddingVertical:34},
  wrap:{width:'100%',maxWidth:610,gap:18},brand:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:14},
  mark:{backgroundColor:green,color:ink,fontWeight:'900',padding:9,fontSize:19},brandText:{color:paper,fontWeight:'900',letterSpacing:2,fontSize:18},
  title:{color:paper,fontWeight:'900',fontSize:54,lineHeight:57,letterSpacing:-2},label:{color:green,fontWeight:'800',letterSpacing:1.6,fontSize:12},
  copy:{color:'#c9cfc6',fontSize:16,lineHeight:24},card:{backgroundColor:'#252c27',borderWidth:1,borderColor:'#495349',borderRadius:16,padding:20,gap:16},
  heading:{color:paper,fontWeight:'800',fontSize:25,lineHeight:32},row:{flexDirection:'row',gap:10,alignItems:'center',flexWrap:'wrap'},
  button:{paddingVertical:14,paddingHorizontal:18,backgroundColor:green,borderRadius:9,borderWidth:1,borderColor:green},secondary:{backgroundColor:'#303932',borderColor:'#59675b'},
  buttonLabel:{color:ink,fontSize:16,fontWeight:'700'},stat:{color:paper,fontWeight:'700',backgroundColor:'#303932',borderRadius:6,padding:10},
  track:{backgroundColor:'#354137',height:6,borderRadius:4,overflow:'hidden'},input:{backgroundColor:ink,color:paper,borderColor:'#69756b',borderWidth:1,borderRadius:8,padding:14,minHeight:95,fontSize:16,textAlignVertical:'top'},
  quote:{color:paper,fontStyle:'italic',lineHeight:24,fontSize:16,borderLeftWidth:3,borderColor:green,paddingLeft:12},error:{color:'#ffbba6',fontSize:16},
  reviewNote:{gap:8,borderTopWidth:1,borderColor:'#495349',paddingTop:16},answer:{color:paper,fontWeight:'700',fontSize:18},
});
