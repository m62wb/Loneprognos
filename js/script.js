document.addEventListener('DOMContentLoaded', function() {

// ---------- Hjälpfunktioner ----------
function p(v){ if(!v) return 0; let n=String(v).replace(',','.'); let x=parseFloat(n); return isNaN(x)?0:x; }
function fc(v){ return new Intl.NumberFormat('sv-SE').format(Math.round(v)); }
function fd(v,d){ return v.toFixed(d).replace('.',','); }
function f2(n){ return Math.round((n+Number.EPSILON)*100)/100; }

// ---------- Konstanter ----------
const DRIFT=4.0, VAB_HPD=12.25, UPCT=0.0165, UMAX=701, UMIN=255, HDIV=141.667;
const O1D=460, O2D=260, O3D=150, OTD=72, OTENKELD=94, SY=2026, EY=2036;
const PBB=59200, SGI_TAK_PARENTAL=10*PBB, SGI_TAK_VAB=7.5*PBB, FK_SKATT=0.30;
const MONTHS = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];

<script src="js/skattetabell.js"></script>
<script src="js/script.js"></script>
</body>

// ---------- Schema för alla lag ----------
function daysBetween(d1,d2){ return Math.floor((Date.UTC(d2.getFullYear(),d2.getMonth(),d2.getDate())-Date.UTC(d1.getFullYear(),d1.getMonth(),d1.getDate()))/(86400000)); }
function getDSTAdjustment(date){ let y=date.getFullYear(), se=new Date(y,2,31); while(se.getDay()!==0) se.setDate(se.getDate()-1); let we=new Date(y,9,31); while(we.getDay()!==0) we.setDate(we.getDate()-1); if(date.getDate()===se.getDate()&&date.getMonth()===se.getMonth()) return -1; if(date.getDate()===we.getDate()&&date.getMonth()===we.getMonth()) return 1; return 0; }
const startA=new Date(2025,11,29), cycleA=[0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0]; let scheduleA={}; for(let i=0;i<365*15;i++) scheduleA[i]=cycleA[i%cycleA.length];
function getShiftA(date){ let d=daysBetween(startA,date); if(d<0) return 0; return scheduleA[d]||0; }
const startB=new Date(2025,11,29), cycleB=[0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,2]; let scheduleB={}; for(let i=0;i<365*15;i++) scheduleB[i]=cycleB[i%cycleB.length];
function getShiftB(date){ let d=daysBetween(startB,date); if(d<0) return 0; return scheduleB[d]||0; }
const startC=new Date(2025,11,29), cycleC=[2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0]; let scheduleC={}; for(let i=0;i<365*15;i++) scheduleC[i]=cycleC[i%cycleC.length];
function getShiftC(date){ let d=daysBetween(startC,date); if(d<0) return 0; return scheduleC[d]||0; }
const startD=new Date(2025,11,29), cycleD=[0,0,2,2,0,0,0,1,1,1,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0]; let scheduleD={}; for(let i=0;i<365*15;i++) scheduleD[i]=cycleD[i%cycleD.length];
function getShiftD(date){ let d=daysBetween(startD,date); if(d<0) return 0; return scheduleD[d]||0; }
const startE=new Date(2026,0,1), cycleE=[0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,0,0,2,2,0,0,0,1,1,1]; let scheduleE={}; for(let i=0;i<365*15;i++) scheduleE[i]=cycleE[i%cycleE.length];
function getShiftE(date){ let d=daysBetween(startE,date); if(d<0) return 0; return scheduleE[d]||0; }
function getOrdinaryShift(date,lag){ if(lag==='A') return getShiftA(date); if(lag==='B') return getShiftB(date); if(lag==='C') return getShiftC(date); if(lag==='D') return getShiftD(date); if(lag==='E') return getShiftE(date); return 0; }
const shiftOverrideMap=new Map();
function getShift(date,lag){ let key=date.toISOString().split('T')[0]; if(shiftOverrideMap.has(key)) return shiftOverrideMap.get(key); return getOrdinaryShift(date,lag); }
function isStorhelg(date){ let m=date.getMonth(),d=date.getDate(); if(m===0&&d===1) return true; if(m===0&&d===6) return true; let e=getEaster(date.getFullYear()); let lf=new Date(e); lf.setDate(e.getDate()-2); let pd=new Date(e); pd.setDate(e.getDate()+1); if(date.toDateString()===lf.toDateString()) return true; if(date.toDateString()===e.toDateString()) return true; if(date.toDateString()===pd.toDateString()) return true; if(m===4&&d===1) return true; let kh=new Date(e); kh.setDate(e.getDate()+39); if(date.toDateString()===kh.toDateString()) return true; if(m===5&&d===6) return true; let mid=getMidsummer(date.getFullYear()); if(date.toDateString()===mid.toDateString()) return true; let mids=new Date(mid); mids.setDate(mid.getDate()+1); if(date.toDateString()===mids.toDateString()) return true; let ah=getAllHelgons(date.getFullYear()); if(date.toDateString()===ah.toDateString()) return true; if(m===11&&(d===24||d===25||d===26)) return true; if(m===11&&d===31) return true; return false; }
function getEaster(year){ let a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1; return new Date(year,month-1,day); }
function getMidsummer(year){ let d=new Date(year,5,20); while(d.getDay()!==6) d.setDate(d.getDate()+1); return d; }
function getAllHelgons(year){ let d=new Date(year,9,31); while(d.getDay()!==6) d.setDate(d.getDate()+1); return d; }
function isPermissionDay(date,lag){ let m=date.getMonth(),d=date.getDate(),shift=getShift(date,lag); if(m===11&&d===24) return true; if(m===11&&d===25&&shift===1) return true; if(m===11&&d===31&&shift===2) return true; if(m===0&&d===1&&shift===1) return true; let mid=getMidsummer(date.getFullYear()),eve=new Date(mid); eve.setDate(mid.getDate()-1); if(date.toDateString()===eve.toDateString()) return true; if(date.toDateString()===mid.toDateString()) return true; let mids=new Date(mid); mids.setDate(mid.getDate()+1); if(date.toDateString()===mids.toDateString()&&shift===1) return true; return false; }
function calcOB(date,shift,lag){ if(isPermissionDay(date,lag)||shift===0) return {ob1:0,ob2:0,ob3:0}; let w=date.getDay(),isWeekend=(w===0||w===6),ob1=0,ob2=0,ob3=0; if(isStorhelg(date)) ob3=12.25; else if(shift===1){ if(isWeekend) ob2=12.25; else ob2=1.25; } else if(shift===2){ if(isWeekend) ob2=12.25; else { ob1=6; ob2=6; } } let dst=getDSTAdjustment(date); if(dst!==0&&shift===2){ if(ob2>=6) ob2+=dst; else if(ob1>=6) ob1+=dst; } return {ob1,ob2,ob3}; }
function getOBForMonth(year,month,lag){ let to1=0,to2=0,to3=0, dim=new Date(year,month,0).getDate(); for(let d=1;d<=dim;d++){ let date=new Date(year,month-1,d); let dateStr=date.toISOString().split('T')[0]; let shift=getShift(date,lag); if(fromvaroMap.has(dateStr)) continue; let ob=calcOB(date,shift,lag); to1+=ob.ob1; to2+=ob.ob2; to3+=ob.ob3; } return {ob1:to1,ob2:to2,ob3:to3}; }
function calcUnion(s){ let f=Math.round(s*UPCT); if(f<UMIN) return UMIN; if(f>UMAX) return UMAX; return 

// ---------- Stationer för lag E ----------
const stationsE=['Reaktorn','Dian','Spray'], initials=['B','Y','M'], refStation=new Date(2026,5,9);
function countWorkShiftsUntil(date,lag){ let cnt=0, d=new Date(refStation); while(daysBetween(d,date)>0){ let sh=getShift(d,lag); if(sh>0 && !isPermissionDay(d,lag)) cnt++; d.setDate(d.getDate()+1); } return cnt; }
function getStationE(date,shift,lag){ if(shift===0||isPermissionDay(date,lag)) return '-'; let ws=countWorkShiftsUntil(date,lag), idx=ws%3, yidx=(idx+1)%3, midx=(idx+2)%3; let bp=stationsE[idx]+'('+initials[0]+')', yp=stationsE[yidx]+'('+initials[1]+')', mp=stationsE[midx]+'('+initials[2]+')'; let day=date.getDay(); if((day===6 && shift===1 && idx===2)||(day===0 && shift===1 && idx===1)) bp+='🧹'; return bp+' '+yp+' '+mp; }

// ---------- Huvudlogik ----------
let manualOBOverride=false, lastAutoOB={ob1:0,ob2:0,ob3:0}, lastAutoLag='', lastAutoYear=0, lastAutoMonth=0;
function updateUI(){
    let baseSalary=p(salaryInput.value)||0, selectedYear=parseInt(yearSelect.value), selectedMonth=parseInt(monthSelect.value), karensDays=parseInt(karensSelect.value), lag=lagSelect.value, isAuto=(lag!=='manual');
    let vabD=[...fromvaroMap.values()].filter(v=>v===2).length, parentalD=[...fromvaroMap.values()].filter(v=>v===3).length, totalVABParental=vabD+parentalD, vacationCount=[...fromvaroMap.values()].filter(v=>v===1).length;
    let ftpD=parseInt(ftpDays.value), sgiVal=Math.min(p(sgiInput.value)||0,SGI_TAK_PARENTAL), extraSick=(karensDays>0||p(sickHours.value)>0)?p(sickHours.value):0;
    if(karensDays>0||extraSick>0){ sjukOBContainer.classList.add('visible'); sickHoursContainer.classList.add('visible'); } else { sjukOBContainer.classList.remove('visible'); sickHoursContainer.classList.remove('visible'); }
    if(totalVABParental>0) vabSummary.style.display='flex'; else vabSummary.style.display='none';
    let driftAddition=Math.round(baseSalary*DRIFT/100), obGroundingBase=baseSalary+driftAddition;
    obGroundingDisplay.innerText=fc(obGroundingBase)+' kr';
    let ob1RatePerHour=obGroundingBase/O1D, ob2RatePerHour=obGroundingBase/O2D, ob3RatePerHour=obGroundingBase/O3D, otRatePerHour=obGroundingBase/OTD, otEnkelRatePerHour=obGroundingBase/OTENKELD;
    let sickRate100=baseSalary/141.667, sickRate80=baseSalary/177.0837;
    ob1Rate.innerText='/460 = '+fd(ob1RatePerHour,2)+' kr/h'; ob2Rate.innerText='/260 = '+fd(ob2RatePerHour,2)+' kr/h'; ob3Rate.innerText='/150 = '+fd(ob3RatePerHour,2)+' kr/h'; otRate.innerText='/72 = '+fd(otRatePerHour,2)+' kr/h'; otEnkelRate.innerText='/94 = '+fd(otEnkelRatePerHour,2)+' kr/h';
    let semesterSupplementPerDay = (baseSalary + driftAddition) / 125;
    let semesterTillagg = f2(vacationCount * semesterSupplementPerDay);
    let karensHours=karensDays*6.8, karensDeduction=karensDays>0?f2(karensHours*sickRate100):0;
    let sickDeduct100=f2(extraSick*sickRate100), sickPay80=f2(extraSick*sickRate80), sickNetLoss=f2(sickDeduct100-sickPay80), totalSickLoss=f2(karensDeduction+sickNetLoss);
    let vabParentalHours=totalVABParental*VAB_HPD, vabParentalDeduction=f2(vabParentalHours*sickRate100);
    let sgiVab=Math.min(sgiVal,SGI_TAK_VAB), sgiVabDay=f2(sgiVab/365*0.8), fkVabTotal=f2(vabD*sgiVabDay);
    let sgiPar=Math.min(sgiVal,SGI_TAK_PARENTAL), fpDayAmt=Math.min(1259,f2(sgiPar/365*0.776)), fkFpTotal=f2(parentalD*fpDayAmt);
    let fptDayAmt=f2(baseSalary/30*0.10), fkFptTotal=f2(ftpD*fptDayAmt);
    let fkVabTax=f2(fkVabTotal*FK_SKATT), fkFpTax=f2(fkFpTotal*FK_SKATT), fkFptTax=f2(fkFptTotal*FK_SKATT);
    let fkVabNet=f2(fkVabTotal-fkVabTax), fkFpNet=f2(fkFpTotal-fkFpTax), fkFptNet=f2(fkFptTotal-fkFptTax), totalErsattningNetto=f2(fkVabNet+fkFpNet+fkFptNet);
    
    let obYear = selectedYear, obMonth = selectedMonth - 1;
    if(obMonth === 0) { obMonth = 12; obYear--; }
    
    let autoOB=null; if(isAuto){ autoOB=getOBForMonth(obYear,obMonth,lag); if(lag!==lastAutoLag||obYear!==lastAutoYear||obMonth!==lastAutoMonth) manualOBOverride=false; lastAutoLag=lag; lastAutoYear=obYear; lastAutoMonth=obMonth; lastAutoOB=autoOB; } else manualOBOverride=false;
    let lockEnabled=obLockToggle.checked, obData;
    document.getElementById('lockLabel').innerText = lockEnabled ? 'Låst' : 'Lås';
    
    if(isAuto&&lockEnabled&&!manualOBOverride){ ob1Hours.value=fd(autoOB.ob1,2); ob2Hours.value=fd(autoOB.ob2,2); ob3Hours.value=fd(autoOB.ob3,2); ob1Hours.disabled=ob2Hours.disabled=ob3Hours.disabled=true; obData=autoOB; }
    else if(isAuto&&lockEnabled&&manualOBOverride){ ob1Hours.disabled=ob2Hours.disabled=ob3Hours.disabled=true; obData={ob1:p(ob1Hours.value),ob2:p(ob2Hours.value),ob3:p(ob3Hours.value)}; }
    else{ ob1Hours.disabled=ob2Hours.disabled=ob3Hours.disabled=false; if(isAuto&&!lockEnabled){ let c1=p(ob1Hours.value),c2=p(ob2Hours.value),c3=p(ob3Hours.value); if(Math.abs(c1-lastAutoOB.ob1)>0.001||Math.abs(c2-lastAutoOB.ob2)>0.001||Math.abs(c3-lastAutoOB.ob3)>0.001) manualOBOverride=true; if(!manualOBOverride){ ob1Hours.value=fd(autoOB.ob1,2); ob2Hours.value=fd(autoOB.ob2,2); ob3Hours.value=fd(autoOB.ob3,2); } obData={ob1:p(ob1Hours.value),ob2:p(ob2Hours.value),ob3:p(ob3Hours.value)}; } else obData={ob1:p(ob1Hours.value),ob2:p(ob2Hours.value),ob3:p(ob3Hours.value)}; }
    let otH=p(otHours.value), otEnkelH=p(otEnkelHours.value);
    let ob1Amount=Math.round(obData.ob1*ob1RatePerHour), ob2Amount=Math.round(obData.ob2*ob2RatePerHour), ob3Amount=Math.round(obData.ob3*ob3RatePerHour), otAmount=Math.round(otH*otRatePerHour), otEnkelAmount=Math.round(otEnkelH*otEnkelRatePerHour);
    let totalOBOnly=ob1Amount+ob2Amount+ob3Amount, totalOBOnlyHours=obData.ob1+obData.ob2+obData.ob3, totalOB=totalOBOnly+otAmount+otEnkelAmount;
    
    let sjukOb1H=(karensDays>0||extraSick>0)?p(sjukOb1Hours.value):0;
    let sjukOb2H=(karensDays>0||extraSick>0)?p(sjukOb2Hours.value):0;
    let sjukOb3H=(karensDays>0||extraSick>0)?p(sjukOb3Hours.value):0;
    let sjukOb1Loss=f2(sjukOb1H*ob1RatePerHour*0.2), sjukOb2Loss=f2(sjukOb2H*ob2RatePerHour*0.2), sjukOb3Loss=f2(sjukOb3H*ob3RatePerHour*0.2), totalSjukOB=f2(sjukOb1Loss+sjukOb2Loss+sjukOb3Loss);
    
    let totalBeforeKarens=obGroundingBase+totalOB+semesterTillagg;
    let jobbBrutto=f2(totalBeforeKarens-totalSickLoss-totalSjukOB-vabParentalDeduction);
    let tax=taxFromTable33Col1(jobbBrutto);
    let netBeforeFack=f2(jobbBrutto-tax);
    let unionFee=calcUnion(jobbBrutto);
    let jobbNetto=f2(netBeforeFack-unionFee);
    let netSalary=f2(jobbNetto+totalErsattningNetto);
    
    let lagName={A:'Lag A',B:'Lag B',C:'Lag C',D:'Lag D',E:'Lag E'}[lag]||'Manuell';
    document.getElementById('selectedPeriod').innerText=MONTHS[selectedMonth-1]+' '+selectedYear+' · '+karensDays+' karensdag'+(karensDays!==1?'ar':'')+(extraSick>0?' +'+fd(extraSick,1)+'h sjuk':'')+' · '+lagName;
    if(isAuto) document.getElementById('tableMonthLabel').innerText=MONTHS[obMonth-1]+' '+obYear; 
    else document.getElementById('tableMonthLabel').innerText='—';
    document.getElementById('finalNetSalary').innerText=fc(netSalary)+' kr';
    document.getElementById('overviewTotalNet').innerText=fc(netSalary)+' kr';
    
    // Översikt
    let obOTHTML='<div class="expandable-chip" onclick="toggleExpand(this)"><div class="expandable-header"><span>Totalt OB</span><span>'+fd(totalOBOnlyHours,2)+'h / +'+fc(totalOBOnly)+' kr <span class="expandable-arrow">▼</span></span></div><div class="expandable-details"><div class="tax-detail-row">OB1 ('+fd(obData.ob1,2)+'h x '+fd(ob1RatePerHour,2)+' kr): +'+fc(ob1Amount)+' kr</div><div class="tax-detail-row">OB2 ('+fd(obData.ob2,2)+'h x '+fd(ob2RatePerHour,2)+' kr): +'+fc(ob2Amount)+' kr</div><div class="tax-detail-row">OB3 ('+fd(obData.ob3,2)+'h x '+fd(ob3RatePerHour,2)+' kr): +'+fc(ob3Amount)+' kr</div><div class="tax-detail-row total">Summa OB: '+fd(totalOBOnlyHours,2)+'h / +'+fc(totalOBOnly)+' kr</div></div></div>';
    if(otH>0) obOTHTML+='<div class="detail-chip"><span>Övertid ('+fd(otH,2)+'h x '+fd(otRatePerHour,2)+' kr)</span><span>+'+fc(otAmount)+' kr</span></div>';
    if(otEnkelH>0) obOTHTML+='<div class="detail-chip"><span>ÖT enkel ('+fd(otEnkelH,2)+'h x '+fd(otEnkelRatePerHour,2)+' kr)</span><span>+'+fc(otEnkelAmount)+' kr</span></div>';
    let karensHTML='', extraSickHTML='', sjukObHTML='', vabHTML='', semesterHTML='', bidragHTML='';
    if(karensDays>0) karensHTML='<div class="detail-chip danger"><span>Karens</span><span>'+karensDays+' dag'+(karensDays>1?'ar':'')+'</span></div>';
    if(extraSick>0) extraSickHTML='<div class="detail-chip danger"><span>Sjuktimmar</span><span>'+fd(extraSick,1)+'h (netto -20%)</span></div>';
    if(totalSjukOB>0) sjukObHTML='<div class="detail-chip danger"><span>Sjuk-OB förlust</span><span>-'+fc(totalSjukOB)+' kr</span></div>';
    if(totalVABParental>0) vabHTML='<div class="detail-chip danger"><span>VAB/F-ledig avdrag</span><span>-'+fc(vabParentalDeduction)+' kr</span></div>';
    if(vacationCount>0) semesterHTML='<div class="detail-chip info"><span>Semestertillägg ('+vacationCount+' dgr, '+fd(semesterSupplementPerDay,2)+' kr/d)</span><span>+'+fc(semesterTillagg)+' kr</span></div>';
    if(totalVABParental>0||ftpD>0) bidragHTML='<div class="detail-chip success"><span>FK/AFA netto</span><span>+'+fc(totalErsattningNetto)+' kr</span></div>';
    let detailHTML='<div class="detail-chip"><span>Grundlön</span><span>'+fc(baseSalary)+' kr</span></div><div class="detail-chip"><span>OB-grundande</span><span>'+fc(obGroundingBase)+' kr</span></div>'+obOTHTML+semesterHTML+karensHTML+extraSickHTML+sjukObHTML+vabHTML+bidragHTML+'<div class="detail-chip"><span>Bruttolön jobb</span><span>'+fc(jobbBrutto)+' kr</span></div><div class="detail-chip"><span>Skatt (tabell 33)</span><span>-'+fc(tax)+' kr</span></div><div class="detail-chip"><span>Nettolön före fack</span><span>'+fc(netBeforeFack)+' kr</span></div><div class="detail-chip"><span>IF Metall</span><span>-'+fc(unionFee)+' kr</span></div><div class="detail-chip"><span>Nettolön jobb</span><span>'+fc(jobbNetto)+' kr</span></div>';
    if(totalErsattningNetto>0) detailHTML+='<div class="detail-chip success"><span>Nettolön bidrag</span><span>+'+fc(totalErsattningNetto)+' kr</span></div>';
    detailHTML+='<div class="detail-chip success"><strong>Totalt netto: '+fc(netSalary)+' kr</strong></div>';
    document.getElementById('detailGrid').innerHTML=detailHTML;
    
    // Dagsschema
    if(isAuto){
        let daysInMonth=new Date(obYear,obMonth,0).getDate();
        let shiftNames=['Ledig','Dag','Natt'];
        let tbody='';
        for(let d=1;d<=daysInMonth;d++){
            let date=new Date(obYear,obMonth-1,d);
            let dateStr=date.toISOString().split('T')[0];
            let fromvaroVal=fromvaroMap.get(dateStr)||0;
            let shift=getShift(date,lag);
            let ob=calcOB(date,shift,lag);
            let isPerm=isPermissionDay(date,lag);
            if (fromvaroVal !== 0) ob = {ob1:0, ob2:0, ob3:0};
            let dayName=['Sön','Mån','Tis','Ons','Tor','Fre','Lör'][date.getDay()];
            let shiftText=isPerm?'Perm':shiftNames[shift];
            if(shiftOverrideMap.has(dateStr)&&!isPerm) shiftText+='*';
            let fromvaroText="";
            if(fromvaroVal===1) fromvaroText="Semester";
            else if(fromvaroVal===2) fromvaroText="VAB";
            else if(fromvaroVal===3) fromvaroText="F-ledig";
            let station=(lag==='E')?getStationE(date,shift,lag):'-';
            let rowClass="";
            if(shift>0 && !isPerm && fromvaroVal===0) rowClass="row-active";
            if(fromvaroVal===1) rowClass+=" row-vacation";
            else if(fromvaroVal===2) rowClass+=" row-vab";
            else if(fromvaroVal===3) rowClass+=" row-parental";
            let fromvaroCell = "";
            if (shift !== 0) {
                fromvaroCell = `<select class="fromvaro-select" onchange="setFromvaro('${dateStr}',this.value)" onclick="event.stopPropagation()">
                    <option value="" ${fromvaroText===""?'selected':''}>Ingen</option>
                    <option value="Semester" ${fromvaroText==="Semester"?'selected':''}>Sem</option>
                    <option value="VAB" ${fromvaroText==="VAB"?'selected':''}>VAB</option>
                    <option value="F-ledig" ${fromvaroText==="F-ledig"?'selected':''}>F-ledig</option>
                </select>`;
            }
            let passSelect=`<select class="shift-select" onchange="changeShift('${dateStr}',this.value,'${lag}')" onclick="event.stopPropagation()">
                <option value="0" ${shift===0?'selected':''}>Led</option>
                <option value="1" ${shift===1?'selected':''}>Dag</option>
                <option value="2" ${shift===2?'selected':''}>Natt</option>
            </select>`;
            tbody+=`<tr class="${rowClass}"><td>${d} ${dayName}</td><td>${shiftText}</td><td>${fd(ob.ob1,2)}h</td><td>${fd(ob.ob2,2)}h</td><td>${fd(ob.ob3,2)}h</td><td>${fromvaroCell}</td><td>${station}</td><td>${passSelect}</td></tr>`;
        }
        document.querySelector('#salaryTable tbody').innerHTML=tbody;
    } else {
        document.querySelector('#salaryTable tbody').innerHTML='<tr><td colspan="8">Välj ett lag</td></tr>';
    }
}
function updateYearSummary(){ let y=parseInt(yearSelect.value), lag=lagSelect.value; if(lag==='manual'){ document.getElementById('yearSummaryGrid').innerHTML='Välj lag'; return; } document.getElementById('yearSummaryYear').innerText=y; let bs=p(salaryInput.value)||0, da=Math.round(bs*DRIFT/100), obBase=bs+da, o1r=obBase/O1D, o2r=obBase/O2D, o3r=obBase/O3D, totBrutto=0, totNetto=0, totSkatt=0, totFack=0, totOB=0; for(let m=1;m<=12;m++){ let obData=getOBForMonth(y,m,lag), ob1Amt=Math.round(obData.ob1*o1r), ob2Amt=Math.round(obData.ob2*o2r), ob3Amt=Math.round(obData.ob3*o3r), mOB=ob1Amt+ob2Amt+ob3Amt; totOB+=mOB; let jb=obBase+mOB, tax=taxFromTable33Col1(jb), uf=calcUnion(jb), net=jb-tax-uf; totBrutto+=jb; totNetto+=net; totSkatt+=tax; totFack+=uf; } document.getElementById('yearSummaryGrid').innerHTML=`<div>Total bruttolön: ${fc(totBrutto)} kr</div><div>Total nettolön: ${fc(totNetto)} kr</div><div>Total skatt: -${fc(totSkatt)} kr</div><div>Fackavgift: -${fc(totFack)} kr</div><div>Totalt OB: +${fc(totOB)} kr</div>`; }

function resetOB(){ if (!manualOBOverride) return; manualOBOverride=false; let lag=lagSelect.value; if(lag!=='manual'){ let y=parseInt(yearSelect.value), m=parseInt(monthSelect.value); let om=m-1; if(om===0){ om=12; y--; } let ob=getOBForMonth(y,om,lag); ob1Hours.value=fd(ob.ob1,2); ob2Hours.value=fd(ob.ob2,2); ob3Hours.value=fd(ob.ob3,2); } else { ob1Hours.value='0'; ob2Hours.value='0'; ob3Hours.value='0'; } updateUI(); }

function toggleExpand(el){ let d=el.querySelector('.expandable-details'), a=el.querySelector('.expandable-arrow'); d.classList.toggle('open'); a.classList.toggle('open'); }
function toggleTheme(){ let html=document.documentElement; if(html.getAttribute('data-theme')==='dark') html.setAttribute('data-theme','light'); else html.setAttribute('data-theme','dark'); }
function toggleVAB(){ let c=document.getElementById('vabContent'), a=document.getElementById('vabArrow'); c.classList.toggle('open'); a.innerText=c.classList.contains('open')?'▲':'▼'; }
function toggleOB(){ let c=document.getElementById('obContent'), a=document.getElementById('obArrow'); c.classList.toggle('open'); a.innerText=c.classList.contains('open')?'▲':'▼'; }
function toggleOverview(){ let c=document.getElementById('overviewContent'); if(c.style.display==='none') c.style.display='block'; else c.style.display='none'; }
function toggleYearSummary(){ let d=document.getElementById('yearDetails'), a=document.getElementById('yearArrow'); if(d.style.display==='none'){ d.style.display='block'; a.innerText='▲'; updateYearSummary(); } else { d.style.display='none'; a.innerText='▼'; } }
function populateSelectors(){ for(let y=SY;y<=EY;y++){ let o=document.createElement('option'); o.value=y; o.textContent=y; yearSelect.appendChild(o); } let now=new Date(); yearSelect.value=Math.max(SY,Math.min(EY,now.getFullYear())); MONTHS.forEach((m,i)=>{ let o=document.createElement('option'); o.value=i+1; o.textContent=m; monthSelect.appendChild(o); }); monthSelect.value=now.getMonth()+1; }

// ---------- Initiera allt ----------
let lagSelect=document.getElementById('lagSelect'), salaryInput=document.getElementById('salaryInput'), yearSelect=document.getElementById('yearSelect'), monthSelect=document.getElementById('monthSelect'), karensSelect=document.getElementById('karensSelect'), otHours=document.getElementById('otHours'), otEnkelHours=document.getElementById('otEnkelHours'), ob1Hours=document.getElementById('ob1Hours'), ob2Hours=document.getElementById('ob2Hours'), ob3Hours=document.getElementById('ob3Hours'), sjukOb1Hours=document.getElementById('sjukOb1Hours'), sjukOb2Hours=document.getElementById('sjukOb2Hours'), sjukOb3Hours=document.getElementById('sjukOb3Hours'), sickHours=document.getElementById('sickHours'), ftpDays=document.getElementById('ftpDays'), sgiInput=document.getElementById('sgiInput'), ob1Rate=document.getElementById('ob1Rate'), ob2Rate=document.getElementById('ob2Rate'), ob3Rate=document.getElementById('ob3Rate'), otRate=document.getElementById('otRate'), otEnkelRate=document.getElementById('otEnkelRate'), selectedPeriod=document.getElementById('selectedPeriod'), finalNetSalary=document.getElementById('finalNetSalary'), detailGrid=document.getElementById('detailGrid'), tableBody=document.querySelector('#salaryTable tbody'), tableMonthLabel=document.getElementById('tableMonthLabel'), obGroundingDisplay=document.getElementById('obGroundingDisplay'), sjukOBContainer=document.getElementById('sjukOBContainer'), sickHoursContainer=document.getElementById('sickHoursContainer'), lockLabel=document.getElementById('lockLabel'), vabSummary=document.getElementById('vabSummary'), vabInfo=document.getElementById('vabInfo'), yearSummaryYear=document.getElementById('yearSummaryYear'), yearSummaryGrid=document.getElementById('yearSummaryGrid'), obLockToggle=document.getElementById('obLockToggle'), overviewTotalNet=document.getElementById('overviewTotalNet');

lagSelect.addEventListener('change',updateUI); salaryInput.addEventListener('input',updateUI); yearSelect.addEventListener('change',updateUI); monthSelect.addEventListener('change',updateUI); karensSelect.addEventListener('change',updateUI); otHours.addEventListener('input',updateUI); otEnkelHours.addEventListener('input',updateUI); ob1Hours.addEventListener('input',updateUI); ob2Hours.addEventListener('input',updateUI); ob3Hours.addEventListener('input',updateUI); sjukOb1Hours.addEventListener('input',updateUI); sjukOb2Hours.addEventListener('input',updateUI); sjukOb3Hours.addEventListener('input',updateUI); sickHours.addEventListener('input',updateUI); ftpDays.addEventListener('change',updateUI); sgiInput.addEventListener('input',updateUI); 

populateSelectors();
updateUI();

// Exponera globala funktioner för onclick i HTML
window.setFromvaro=setFromvaro; window.changeShift=changeShift; window.resetSchema=resetSchema; window.resetAllShifts=resetAllShifts; window.resetOB=resetOB; window.toggleExpand=toggleExpand; window.toggleYearSummary=toggleYearSummary; window.toggleVAB=toggleVAB; window.toggleOB=toggleOB; window.toggleOverview=toggleOverview;

}); // Slut på DOMContentLoaded
