/**
 * Genera un expediente FICTICIO para pruebas automatizadas (tests/fixtures/expediente-ficticio.pdf).
 * Todas las personas, empresas, montos y hechos son inventados y cada página lo indica.
 * NO es un expediente real y no debe usarse como tal.
 */
import fs from "node:fs";
import PDFDocument from "pdfkit";

const AVISO = "DOCUMENTO FICTICIO GENERADO PARA PRUEBAS DE SOFTWARE — NO ES UN EXPEDIENTE REAL";
const piezas: { titulo: string; parrafos: string[] }[] = [
  {
    titulo: "PROMUEVE DEMANDA POR DAÑOS Y PERJUICIOS",
    parrafos: [
      "Señor Juez: Ana Prueba Ficticia, DNI 00.000.001, por derecho propio, con el patrocinio letrado del Dr. Test Ejemplo, me presento y digo:",
      "I. OBJETO. Que vengo a promover demanda por daños y perjuicios contra Transportes Imaginarios S.A., por la suma de PESOS CINCO MILLONES ($ 5.000.000), o lo que en más o en menos resulte de la prueba, con más intereses y costas.",
      "II. HECHOS. El día 10 de marzo de 2023, aproximadamente a las 8:15 horas, mientras cruzaba la avenida Ficticia por la senda peatonal con el semáforo en verde, fui embestida por el colectivo interno 45 de la demandada, que circulaba a velocidad excesiva.",
      "Como consecuencia del impacto sufrí fractura de tibia derecha, debiendo ser intervenida quirúrgicamente y permanecer tres meses sin poder trabajar.",
      "III. RUBROS. Reclamo incapacidad sobreviniente $ 3.000.000; daño moral $ 1.500.000; gastos médicos y de traslado $ 500.000.",
      "IV. PRUEBA. Ofrezco la declaración testimonial de Carlos Testigo Uno y María Testigo Dos, pericia médica y pericia accidentológica.",
    ],
  },
  {
    titulo: "CONTESTA DEMANDA",
    parrafos: [
      "Señor Juez: Transportes Imaginarios S.A., por intermedio de su apoderada, contesta la demanda y solicita su rechazo con costas.",
      "I. NEGATIVAS. Niega que el colectivo interno 45 circulara a velocidad excesiva. Niega que la actora cruzara con el semáforo en verde.",
      "II. VERSIÓN DE LOS HECHOS. La actora cruzó de manera intempestiva, fuera de la senda peatonal y con el semáforo en rojo para peatones, configurándose la culpa de la víctima como eximente de responsabilidad.",
      "III. RUBROS. Impugna los montos reclamados por excesivos y carentes de respaldo documental.",
    ],
  },
  {
    titulo: "ACTA DE AUDIENCIA TESTIMONIAL",
    parrafos: [
      "En la fecha comparece Carlos Testigo Uno, quien declara: que el día del hecho esperaba el colectivo en la esquina; que vio a la señora cruzar por la senda peatonal; que el semáforo peatonal estaba en verde; que el colectivo venía rápido.",
      "Acto seguido comparece María Testigo Dos, quien declara: que caminaba por la vereda; que escuchó una frenada; que no vio el color del semáforo; que la señora estaba a unos dos metros de la senda peatonal cuando cayó.",
    ],
  },
  {
    titulo: "SENTENCIA DE PRIMERA INSTANCIA",
    parrafos: [
      "Y VISTOS: los autos ficticios caratulados “Prueba Ficticia, Ana c/ Transportes Imaginarios S.A. s/ daños y perjuicios”.",
      "CONSIDERANDO: Que la declaración del testigo Carlos Testigo Uno resulta precisa y concordante en cuanto a que la actora cruzaba por la senda peatonal con el semáforo habilitante.",
      "Que la testigo María Testigo Dos no presenció el color del semáforo, por lo que su relato no desvirtúa lo anterior.",
      "Que la demandada no acreditó la culpa de la víctima que invocó como eximente.",
      "FALLO: Haciendo lugar parcialmente a la demanda, condenando a Transportes Imaginarios S.A. a abonar a la actora la suma de PESOS TRES MILLONES DOSCIENTOS MIL ($ 3.200.000), con más intereses y costas.",
    ],
  },
];

const out = new URL("./expediente-ficticio.pdf", import.meta.url);
const doc = new PDFDocument({ size: "A4", margin: 60 });
doc.pipe(fs.createWriteStream(out));
piezas.forEach((p, i) => {
  if (i) doc.addPage();
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#a00").text(AVISO).fillColor("black").moveDown();
  doc.fontSize(14).text(p.titulo).moveDown();
  doc.font("Helvetica").fontSize(11);
  p.parrafos.forEach((t) => doc.text(t, { align: "justify" }).moveDown(0.8));
});
doc.end();
console.log(`Generado ${out.pathname}`);
