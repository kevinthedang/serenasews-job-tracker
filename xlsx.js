/*
 * Minimal, dependency-free .xlsx writer for the job tracker.
 * Produces a valid OOXML workbook with one "Jobs" sheet, a styled header,
 * currency formatting, frozen header row, filters, and a totals row.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SerenaXlsx = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var RUSH_FEE = 10;
  var encoder = new TextEncoder();
  var crcTable = null;

  function money(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function strCell(ref, value, style) {
    return (
      '<c r="' + ref + '"' +
      (style ? ' s="' + style + '"' : "") +
      ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEscape(value) +
      "</t></is></c>"
    );
  }

  function numCell(ref, value, style) {
    return (
      '<c r="' + ref + '"' +
      (style ? ' s="' + style + '"' : "") +
      "><v>" +
      money(value) +
      "</v></c>"
    );
  }

  function intCell(ref, value, style) {
    return (
      '<c r="' + ref + '"' +
      (style ? ' s="' + style + '"' : "") +
      "><v>" +
      (Math.round(Number(value) || 0) || 0) +
      "</v></c>"
    );
  }

  function formulaCell(ref, formula, cachedValue, style) {
    return (
      '<c r="' + ref + '"' +
      (style ? ' s="' + style + '"' : "") +
      "><f>" +
      formula +
      "</f><v>" +
      money(cachedValue) +
      "</v></c>"
    );
  }

  function excelSerial(iso) {
    var parts = String(iso == null ? "" : iso).split("-");
    if (parts.length !== 3) return null;
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    if (!year || !month || !day) return null;
    var utc = Date.UTC(year, month - 1, day);
    if (isNaN(utc)) return null;
    var date = new Date(utc);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
  }

  function dateCell(ref, iso, style) {
    var serial = excelSerial(iso);
    if (serial === null) {
      return strCell(ref, iso || "", style);
    }
    return (
      '<c r="' + ref + '"' +
      (style ? ' s="' + style + '"' : "") +
      "><v>" +
      serial +
      "</v></c>"
    );
  }

  function buildSheet(jobs) {
    var count = jobs.length;
    var lastDataRow = count + 1;
    var totalsRow = count + 2;

    var rows = [];
    var headers = [
      "Appointment Date",
      "Name",
      "# of Pieces",
      "Rush",
      "Price",
      "Tips",
      "Contains Bridal",
      "Total - Sale",
      "Service",
    ];
    var headerCells = "";
    for (var h = 0; h < headers.length; h++) {
      headerCells += strCell(String.fromCharCode(65 + h) + "1", headers[h], 1);
    }
    rows.push('<row r="1" ht="22" customHeight="1">' + headerCells + "</row>");

    var sumGarments = 0;
    var sumJob = 0;
    var sumRush = 0;
    var sumTips = 0;
    var sumTotal = 0;

    for (var i = 0; i < count; i++) {
      var job = jobs[i] || {};
      var r = i + 2;
      var rush = job.rush ? RUSH_FEE : 0;
      var jobPrice = money(job.jobPrice);
      var tips = money(job.tips);
      var total = money(job.total != null ? job.total : jobPrice + rush + tips);
      var garments = Math.max(0, Math.round(Number(job.garments) || 0));

      sumGarments += garments;
      sumJob += jobPrice;
      sumRush += rush;
      sumTips += tips;
      sumTotal += total;

      rows.push(
        '<row r="' + r + '">' +
          dateCell("A" + r, job.date, 5) +
          strCell("B" + r, job.client || "") +
          intCell("C" + r, garments) +
          (rush > 0 ? numCell("D" + r, rush, 2) : '<c r="D' + r + '" s="2"/>') +
          numCell("E" + r, jobPrice, 2) +
          (tips > 0 ? numCell("F" + r, tips, 2) : '<c r="F' + r + '" s="2"/>') +
          (job.bridal ? strCell("G" + r, "Yes") : '<c r="G' + r + '"/>') +
          formulaCell("H" + r, "SUM(D" + r + ":F" + r + ")", total, 2) +
          strCell("I" + r, job.service || "") +
        "</row>"
      );
    }

    var sumRange = function (col) {
      return "SUM(" + col + "2:" + col + lastDataRow + ")";
    };

    rows.push(
      '<row r="' + totalsRow + '">' +
        strCell("A" + totalsRow, "Total", 3) +
        "<c r=\"B" + totalsRow + "\"/>" +
        formulaCell("C" + totalsRow, sumRange("C"), sumGarments, 3) +
        formulaCell("D" + totalsRow, sumRange("D"), money(sumRush), 4) +
        formulaCell("E" + totalsRow, sumRange("E"), money(sumJob), 4) +
        formulaCell("F" + totalsRow, sumRange("F"), money(sumTips), 4) +
        "<c r=\"G" + totalsRow + "\"/>" +
        formulaCell("H" + totalsRow, sumRange("H"), money(sumTotal), 4) +
        "<c r=\"I" + totalsRow + "\"/>" +
      "</row>"
    );

    var cols =
      '<cols>' +
      '<col min="1" max="1" width="22" customWidth="1"/>' +
      '<col min="2" max="2" width="23" customWidth="1"/>' +
      '<col min="3" max="3" width="13" customWidth="1"/>' +
      '<col min="4" max="4" width="10" customWidth="1"/>' +
      '<col min="5" max="5" width="11" customWidth="1"/>' +
      '<col min="6" max="6" width="9" customWidth="1"/>' +
      '<col min="7" max="7" width="17" customWidth="1"/>' +
      '<col min="8" max="8" width="14" customWidth="1"/>' +
      '<col min="9" max="9" width="20" customWidth="1"/>' +
      "</cols>";

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<dimension ref="A1:I' + totalsRow + '"/>' +
      '<sheetViews><sheetView tabSelected="1" workbookViewId="0">' +
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      "</sheetView></sheetViews>" +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      cols +
      "<sheetData>" + rows.join("") + "</sheetData>" +
      '<autoFilter ref="A1:I' + lastDataRow + '"/>' +
      "</worksheet>"
    );
  }

  function buildStyles() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2">' +
      '<numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/>' +
      '<numFmt numFmtId="165" formatCode="mm-dd-yy"/>' +
      "</numFmts>" +
      '<fonts count="3">' +
      '<font><sz val="11"/><color rgb="FF302734"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FF302734"/><name val="Calibri"/><family val="2"/></font>' +
      "</fonts>" +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF5A3654"/><bgColor indexed="64"/></patternFill></fill>' +
      "</fills>" +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="6">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">' +
      '<alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }

  function buildWorkbook() {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      "<workbookPr/>" +
      '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="10000"/></bookViews>' +
      '<sheets><sheet name="Jobs" sheetId="1" r:id="rId1"/></sheets>' +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      "</workbook>"
    );
  }

  function makeCrcTable() {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    if (!crcTable) {
      crcTable = makeCrcTable();
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    var time =
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() & 0x3f) >> 1);
    var day =
      (((date.getFullYear() - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f);
    return { time: time, date: day };
  }

  function makeZip(files) {
    var chunks = [];
    var central = [];
    var offset = 0;
    var stamp = dosDateTime(new Date());

    for (var i = 0; i < files.length; i++) {
      var name = encoder.encode(files[i].name);
      var data = files[i].data;
      var crc = crc32(data);

      var local = new Uint8Array(30 + name.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      local.set(name, 30);
      chunks.push(local, data);

      var entry = new Uint8Array(46 + name.length);
      var cv = new DataView(entry.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      entry.set(name, 46);
      central.push(entry);

      offset += local.length + data.length;
    }

    var centralSize = 0;
    for (var c = 0; c < central.length; c++) {
      centralSize += central[c].length;
    }

    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(chunks.concat(central, [end]), {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  function buildJobWorkbook(jobs) {
    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>";

    var rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>";

    var workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>";

    var files = [
      { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
      { name: "_rels/.rels", data: encoder.encode(rootRels) },
      { name: "xl/workbook.xml", data: encoder.encode(buildWorkbook()) },
      { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
      { name: "xl/styles.xml", data: encoder.encode(buildStyles()) },
      { name: "xl/worksheets/sheet1.xml", data: encoder.encode(buildSheet(jobs || [])) },
    ];

    return makeZip(files);
  }

  return {
    buildJobWorkbook: buildJobWorkbook,
    money: money,
  };
});
