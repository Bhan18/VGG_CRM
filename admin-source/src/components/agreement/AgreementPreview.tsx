
import { FormData } from "@/components/pages/GenerateAgreementPage";
import { formatIndianCurrency, amountInTeluguWords } from "@/utils/amountInWords";

interface AgreementPreviewProps {
  form: FormData; calculations: { totalPrice: number; finalPrice: number; amountPaid: number; discount: number; balance: number; };
  teluguTranslations: Record<string, string>;
}

function formatDateTelugu(dateString: string): string {
  if (!dateString) return "__________";
  const date = new Date(`${dateString}T00:00:00`);
  const months = ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"];
  return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
}

export default function AgreementPreview({ form, calculations, teluguTranslations }: AgreementPreviewProps) {
  const fc = formatIndianCurrency; const aw = amountInTeluguWords;
  const custName = teluguTranslations.customerName || "________"; const custFather = teluguTranslations.customerFatherName || "________"; const custAddr = teluguTranslations.customerAddress || "________";
  const sellName = teluguTranslations.sellerName || "________"; const sellFather = teluguTranslations.sellerFatherName || "________"; const sellAddr = "JJ Nagar Colony";
  const projName = teluguTranslations.projectName || "________"; const distName = teluguTranslations.district || "________"; const mandName = teluguTranslations.mandal || "________"; const villName = teluguTranslations.village || "________";

  return (
    <article id="agreement-document" className="agreement-content" style={{ fontFamily: "'Noto Sans Telugu', 'Nirmala UI', Arial, sans-serif", fontSize: "18px", lineHeight: "2", color: "#000", background: "#fff", padding: "0" }}>
     
      <div style={{ textAlign: "center",display : "flex",justifyContent: "center", marginTop:"600px", marginBottom: "20px" }}><p style={{ fontWeight: "bold", fontSize: "20px" }}>విక్రయ ఆధీన బయానా ఎగ్రిమెంటు</p></div>
      <p style={{marginLeft : "100px",marginTop:"20px"}}><strong>1)</strong> రూ.{fc(calculations.totalPrice)}/-లు వ్రాయించి ఇచ్చిన ఖాళీ నివేశన స్థలం విక్రయ ఆధీన బయానా ఎగ్రిమెంటు.</p>
      <p style={{marginLeft : "100px",marginTop:"20px"}}><strong>2)</strong> ది. {formatDateTelugu(form.agreementDate)} వ తేదీన</p>
      <p style={{marginLeft : "100px",marginTop:"20px"}}><strong>3)</strong> కొనుగోలుదారు:- తండ్రి/భర్త పేరు: {custFather}, {custAddr} లో కాపురస్తులు {custFather} గారి కుమారుడు/కుమార్తె {custName}, వయస్సు {form.customerAge || "____"} సంవత్సరాలు. ఆధార్ నెం.: {form.customerAadhaar || "________"}</p>
      <p style={{marginLeft : "100px",marginTop:"20px"}}><strong>4)</strong> వ్రాయించి ఇచ్చినవారు:- {sellAddr} లో కాపురస్తులు {sellFather} గారి కుమారుడు {sellName}, వయస్సు {form.sellerAge || "____"} సం.లు. ఆధార్ నెం. {form.sellerAadhaar || "________"}</p>






      <p><strong>5)</strong> స్వభావం:- నా సంపూర్ణ స్వాధీన హక్కుభుక్తములలో గల ఆస్తి అనగా {projName} అనుపేరుతో అనగా {distName} జిల్లా, {mandName} మండలం, {villName} గ్రామం, R.S.నెం. {form.rsNumber || "________"} లోగల ప్లాటు నెం. <strong>{form.plotNumber || "____"}</strong>, <strong>{form.plotSize || "____"} సెంట్లు</strong> స్థిరాస్తి ఖాళీ నివేశన స్థలమును మీకు నేను విక్రయించుటకు అంగీకరించడమైనది. 1 సెంటుకి రూ.{fc(Number(form.pricePerCent) || 0)}/-లు చొప్పున {form.plotSize || "____"} సెంట్లుకి అయిన మొత్తం రూ.{fc(calculations.totalPrice)}/- (అక్షరాల {aw(calculations.totalPrice)}) విక్రయించటమైనది. సదరు విక్రయధనం నుండి యీ ఎగ్రిమెంటు వ్రాతకాలమందు రూ.{fc(calculations.amountPaid)}/-లు (అక్షరాల {aw(calculations.amountPaid)}) నగదుగా ఇచ్చినారు గనుక మీరు నాకు ముట్టినది. మిగిలిన క్రయధనం రూ.{fc(calculations.balance)}/-లు (అక్షరాల {aw(calculations.balance)}) ది. {formatDateTelugu(form.registrationDate)} వ తేదీలోగా మీరు నాకు ఇచ్చి మీ పేరున గాని మీరు కోరిన వారి పేరున గాని రిజిస్ట్రేషన్ చేయించుకోవలయును. సదరు షెడ్యూలు దాఖలా ఆస్తిని లోగడ రిజిస్ట్రేషన్ తనఖా దస్తావేజు చేయుటతప్ప ఇంక ఎవరికి ఏవిధమైన తాకట్టు, క్రయం, దఖలు మొదలుగా గల ఎటువంటి అన్యాక్రాంతములు చేసియుండలేదు అనియు నదరు షెడ్యూలు ఆస్తియందు నాకు మాత్రమే సంపూర్ణ స్వాధీన హక్కుభుక్తములు కలవు అనియు ఇతరులకెవరికి యెటువంటి హక్కులు లేవు అని మిమ్ములను నమ్మించి మీపేర విక్రయ ఆసాధీన బయానా ఎగ్రిమెంటును వ్రాయించి ఇవ్వడమైనది. షెడ్యూలు ఆస్తి పై గల తనఖా బాకీని పూర్తిగా తీర్చానం చేసి మీకు తెలియవరించిన క్షణంటనే మీరు రిజిస్ట్రేషన్ చేయించుకోవలయును. మిగిలిన విక్రయధనము ఏదైన యుంటే, పరస్పర ఒప్పందము ప్రకారము రిజిస్ట్రేషన్ జరిగే నాటికి మీరు చెల్లించి, మీ పేరున గాని, మీరు కోరిన వారి పేరున గాని రిజిస్ట్రేషన్ చేయించుకోవలెను. సదరు షెడ్యూలు దాఖలా ఆస్తిని ఇప్పటివరకు రిజిస్ట్రేషన్ తనఖా దస్తావేజు చేయుట తప్ప, ఇంకెవరికిని ఏ విధమైన తాకట్టు, క్రయము, దఖలు, విక్రయ ఒప్పందము లేదా ఇతర అన్యాక్రాంతములు చేయలేదు. సదరు షెడ్యూలు ఆస్తియందు నాకు మాత్రమే సంపూర్ణ స్వాధీన హక్కుభుక్తములు కలవు. ఇతరులకు ఎటువంటి హక్కులు లేవని మిమ్ములను నమ్మించి ఈ పూర్తి అంగీకరణ స్వభావమును వ్రాసి ఇచ్చినదానిని.</p>
      <p style={{ fontWeight: "bold"}}><strong>6)</strong> ఆస్తి షెడ్యూలు:- {distName} జిల్లా, {mandName} మండలం, {villName} గ్రామం, R.S.నెం. {form.rsNumber || "________"} లోగల ప్లాటు నెం. <strong>{form.plotNumber || "____"}</strong>, <strong>{form.plotSize || "____"} సెంట్లు</strong> స్థిరాస్తి ఖాళీ నివేశన స్థలము మీకు విక్రయ ఖరారు చేయటమైనది.</p>
      <p style={{ marginTop: "10px", fontWeight: "bold" }}>ఇది నా సమ్మతిన వ్రాయించి ఇచ్చిన స్థిరాస్తి ఖాళీ నివేశన స్థలం విక్రయ ఆసాధీన బయానా ఎగ్రిమెంటు.</p>


      <div style={{marginLeft: "60px", marginTop: "10px" }}>
        <p style={{ fontWeight: "bold", marginBottom: "40px" }}>ఇందుకు సాక్షులు:-</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <div><div style={{ marginBottom: "40px" }}>1. __________________</div></div>
          <div><div style={{ marginBottom: "40px" }}>2. __________________</div></div>
        </div>
      </div>
    </article>
  );
}

