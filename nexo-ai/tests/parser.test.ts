import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { inferKind, parseWhatsAppText, titleFromFileName } from "@/lib/whatsapp/parser";
import { extractChat, ImportFileError } from "@/lib/whatsapp/archive";

const ANDROID = `12/03/2024, 08:58 - Los mensajes y las llamadas están cifrados de extremo a extremo. Nadie fuera de este chat, ni siquiera WhatsApp, puede leerlos ni escucharlos.
12/03/2024, 09:00 - Laura Gómez creó el grupo "Cocina Centro"
12/03/2024, 09:15 - Laura Gómez: Hay que pedir harina 000 para mañana
13/03/2024, 10:02 - Martín Ruiz: Listo, ya la pedí.
Llega el jueves a primera hora
y son 10 bolsas
13/03/2024, 10:05 - Martín Ruiz: <Multimedia omitido>
13/03/2024, 10:06 - Laura Gómez: Se eliminó este mensaje
13/03/2024, 10:07 - Pablo Díaz: Perfecto, gracias <Se editó este mensaje.>`;

describe("parser de WhatsApp", () => {
  it("lee el formato Android en español con multilínea, sistema, multimedia, eliminados y editados", () => {
    const r = parseWhatsAppText(ANDROID);
    expect(r.dateOrder).toBe("DMY");
    expect(r.dateOrderAmbiguous).toBe(false);
    expect(r.messages).toHaveLength(7);
    const [enc, created, task, done, media, deleted, edited] = r.messages;
    expect(enc.kind).toBe("system");
    expect(enc.author).toBeNull();
    expect(created.kind).toBe("system");
    expect(task).toMatchObject({ author: "Laura Gómez", body: "Hay que pedir harina 000 para mañana", sentAt: "2024-03-12T09:15:00", kind: "text", line: 3 });
    expect(done.body).toBe("Listo, ya la pedí.\nLlega el jueves a primera hora\ny son 10 bolsas");
    expect(done.line).toBe(4);
    expect(done.raw.split("\n")).toHaveLength(3);
    expect(media.kind).toBe("media");
    expect(deleted.kind).toBe("deleted");
    expect(edited).toMatchObject({ kind: "text", edited: true, body: "Perfecto, gracias" });
    expect(r.authors.sort()).toEqual(["Laura Gómez", "Martín Ruiz", "Pablo Díaz"]);
    expect(inferKind(r)).toBe("group");
  });

  it("lee el formato iOS con corchetes, segundos y marcas LRM", () => {
    const ios = [
      "‎[12/03/24, 09:15:32] Cocina Centro: ‎Laura Gómez creó este grupo",
      "[12/03/24, 09:16:01] Laura Gómez: Revisen la cámara de frío",
      "‎[12/03/24, 09:17:10] Martín Ruiz: ‎imagen omitida",
      "[13/03/24, 21:40:00] Martín Ruiz: Hecho ✅",
    ].join("\r\n");
    const r = parseWhatsAppText(ios);
    expect(r.messages.map((m) => m.kind)).toEqual(["system", "text", "media", "text"]);
    expect(r.messages[0].author).toBeNull();
    expect(r.messages[1]).toMatchObject({ author: "Laura Gómez", sentAt: "2024-03-12T09:16:01" });
    expect(r.messages[3].sentAt).toBe("2024-03-13T21:40:00");
  });

  it("convierte horarios de 12 h con «a. m./p. m.» y espacios finos", () => {
    const r = parseWhatsAppText(
      "5/3/24, 9:05 a. m. - Ana: Abrimos\n5/3/24, 12:30 p. m. - Ana: Almuerzo\n5/3/24, 12:10 a. m. - Ana: Cierre\n25/3/24, 11:59 p. m. - Ana: Fin",
    );
    expect(r.messages.map((m) => m.sentAt)).toEqual([
      "2024-03-05T09:05:00",
      "2024-03-05T12:30:00",
      "2024-03-05T00:10:00",
      "2024-03-25T23:59:00",
    ]);
  });

  it("detecta formato mes/día (inglés, AM/PM)", () => {
    const r = parseWhatsAppText("3/14/24, 9:15 PM - John: Order more flour\n3/15/24, 7:02 AM - Mary: Done");
    expect(r.dateOrder).toBe("MDY");
    expect(r.messages[0].sentAt).toBe("2024-03-14T21:15:00");
    expect(r.messages[1].sentAt).toBe("2024-03-15T07:02:00");
  });

  it("avisa cuando el orden de fecha es ambiguo y permite forzarlo", () => {
    const text = "03/04/2024, 10:00 - Ana: Hola";
    const auto = parseWhatsAppText(text);
    expect(auto.dateOrderAmbiguous).toBe(true);
    expect(auto.messages[0].sentAt).toBe("2024-04-03T10:00:00");
    expect(auto.warnings.join(" ")).toMatch(/ambiguo/);
    const forced = parseWhatsAppText(text, { dateOrder: "MDY" });
    expect(forced.messages[0].sentAt).toBe("2024-03-04T10:00:00");
  });

  it("soporta fechas ISO y separadores con puntos", () => {
    expect(parseWhatsAppText("2024-03-12 09:15 - Ana: Hola").messages[0].sentAt).toBe("2024-03-12T09:15:00");
    expect(parseWhatsAppText("12.03.24, 09:15 - Ana: Hola").messages[0].sentAt).toBe("2024-03-12T09:15:00");
  });

  it("no confunde una línea que empieza con fecha dentro de un mensaje con un encabezado", () => {
    const r = parseWhatsAppText("12/03/2024, 09:15 - Ana: Pedidos:\n13/03 entregar a Centro\n14/03 entregar a Norte");
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].body).toBe("Pedidos:\n13/03 entregar a Centro\n14/03 entregar a Norte");
  });

  it("conserva dos puntos dentro del texto y URLs", () => {
    const r = parseWhatsAppText("12/03/2024, 09:15 - Ana: Nota: ver https://ejemplo.com/a:b");
    expect(r.messages[0]).toMatchObject({ author: "Ana", body: "Nota: ver https://ejemplo.com/a:b" });
  });

  it("ignora fechas imposibles tratándolas como continuación", () => {
    const r = parseWhatsAppText("12/03/2024, 09:15 - Ana: Hola\n31/02/2024, 10:00 - Ana: imposible");
    expect(r.messages).toHaveLength(1);
    expect(r.warnings.some((w) => /fecha inválida/.test(w))).toBe(true);
  });

  it("devuelve advertencia si el archivo no es un chat", () => {
    const r = parseWhatsAppText("hola\nesto no es un chat");
    expect(r.messages).toHaveLength(0);
    expect(r.warnings.at(-1)).toMatch(/No se reconoció/);
  });

  it("individual cuando hay dos autores", () => {
    expect(inferKind(parseWhatsAppText("12/03/2024, 09:15 - Ana: Hola\n12/03/2024, 09:16 - Beto: Hola"))).toBe("individual");
  });

  it("infiere el título desde el nombre del archivo", () => {
    expect(titleFromFileName("Chat de WhatsApp con Cocina Centro.txt")).toBe("Cocina Centro");
    expect(titleFromFileName("WhatsApp Chat with Proveedores.zip")).toBe("Proveedores");
    expect(titleFromFileName("_chat.txt")).toBe("Conversación sin título");
  });
});

describe("lector de archivos", () => {
  it("extrae el chat de un ZIP y no guarda adjuntos", () => {
    const zip = zipSync({
      "_chat.txt": strToU8("12/03/2024, 09:15 - Ana: Hola"),
      "IMG-0001.jpg": new Uint8Array([1, 2, 3]),
      "__MACOSX/._chat.txt": strToU8("x"),
    });
    const r = extractChat("WhatsApp Chat - Cocina.zip", zip);
    expect(r.sourceKind).toBe("zip");
    expect(r.innerName).toBe("_chat.txt");
    expect(r.ignoredAttachments).toBe(1);
    expect(parseWhatsAppText(r.text).messages).toHaveLength(1);
  });

  it("rechaza formatos no soportados y ZIP sin chat", () => {
    expect(() => extractChat("foto.png", new Uint8Array([137, 80, 78, 71]))).toThrow(ImportFileError);
    expect(() => extractChat("x.zip", zipSync({ "a.jpg": new Uint8Array([1]) }))).toThrow(/no contiene/);
    expect(() => extractChat("vacío.txt", new Uint8Array())).toThrow(/vacío/);
  });

  it("decodifica UTF-16 LE con BOM", () => {
    const s = "12/03/2024, 09:15 - Ana: Ñandú";
    const buf = new Uint8Array(2 + s.length * 2);
    buf[0] = 0xff; buf[1] = 0xfe;
    for (let i = 0; i < s.length; i++) { buf[2 + i * 2] = s.charCodeAt(i) & 0xff; buf[3 + i * 2] = s.charCodeAt(i) >> 8; }
    expect(parseWhatsAppText(extractChat("c.txt", buf).text).messages[0].body).toBe("Ñandú");
  });
});
