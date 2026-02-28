import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PreviewLoading from "./PreviewLoading";
import PreviewError from "./PreviewError";
import styles from "./OfficePreview.module.css";
import api from "../../services/api";

const OfficePreview = ({ file, fileType, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Excel state
  const [excelData, setExcelData] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [currentSheet, setCurrentSheet] = useState(0);

  // Word state
  const [wordHtml, setWordHtml] = useState(null);

  // PowerPoint state
  const [pptUrl, setPptUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.getFilePreview(file._id);
        if (cancelled) return;

        if (fileType === "excel") {
          const arrayBuffer = await response.data.arrayBuffer();
          if (cancelled) return;
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          setExcelSheets(workbook.SheetNames);
          setExcelData(workbook);
          setCurrentSheet(0);
        } else if (fileType === "word") {
          const arrayBuffer = await response.data.arrayBuffer();
          if (cancelled) return;
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setWordHtml(result.value);
        } else if (fileType === "powerpoint") {
          const url = URL.createObjectURL(response.data);
          if (cancelled) return;
          setPptUrl(url);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading office file:", err);
        setError("Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFile();

    return () => {
      cancelled = true;
      if (pptUrl) URL.revokeObjectURL(pptUrl);
    };
  }, [file._id, fileType]);

  if (loading) return <PreviewLoading message="Loading document..." />;
  if (error) {
    return (
      <PreviewError
        error={error}
        onDownload={onDownload}
        fileName={file.name}
      />
    );
  }

  // Excel rendering
  if (fileType === "excel" && excelData) {
    const sheet = excelData.Sheets[excelSheets[currentSheet]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    return (
      <div className={styles.officePreview}>
        {excelSheets.length > 1 && (
          <div className={styles.sheetTabs}>
            <button
              onClick={() => setCurrentSheet(Math.max(currentSheet - 1, 0))}
              disabled={currentSheet === 0}
              className={styles.controlBtn}
            >
              <ChevronLeft size={16} />
            </button>
            {excelSheets.map((name, idx) => (
              <button
                key={name}
                className={`${styles.sheetTab} ${
                  idx === currentSheet ? styles.activeTab : ""
                }`}
                onClick={() => setCurrentSheet(idx)}
              >
                {name}
              </button>
            ))}
            <button
              onClick={() =>
                setCurrentSheet(
                  Math.min(currentSheet + 1, excelSheets.length - 1),
                )
              }
              disabled={currentSheet === excelSheets.length - 1}
              className={styles.controlBtn}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        <div className={styles.tableContainer}>
          <table className={styles.excelTable}>
            <tbody>
              {jsonData.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell != null ? String(cell) : ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Word rendering
  if (fileType === "word" && wordHtml) {
    return (
      <div className={styles.officePreview}>
        <div
          className={styles.wordContent}
          dangerouslySetInnerHTML={{ __html: wordHtml }}
        />
      </div>
    );
  }

  // PowerPoint rendering (basic)
  if (fileType === "powerpoint" && pptUrl) {
    return (
      <div className={styles.officePreview}>
        <div className={styles.pptPlaceholder}>
          <p>PowerPoint preview is limited. Download for full viewing.</p>
          <button onClick={onDownload} className={styles.downloadBtn}>
            Download File
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default OfficePreview;
