import React, { useState, useEffect } from "react";
import { Chess } from "chess.js";

// Wikimedia Commons SVG Chess Pieces
const PIECE_IMAGES = {
    w: {
        k: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
        q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
        r: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
        b: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
        n: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
        p: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg"
    },
    b: {
        k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
        q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
        r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
        b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
        n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
        p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg"
    }
};

export default function PGNViewer({ pgn }) {
    const [fenHistory, setFenHistory] = useState([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [board, setBoard] = useState([]); // 8x8 representation

    // Initialize: Parse PGN and build history
    useEffect(() => {
        if (!pgn) return;
        try {
            const game = new Chess();
            game.loadPgn(pgn);

            const moves = game.history();

            // Generate full history
            game.reset();
            const history = [];
            // Push initial state
            history.push({ fen: game.fen(), board: game.board() });

            for (const move of moves) {
                game.move(move);
                history.push({ fen: game.fen(), board: game.board() });
            }

            setFenHistory(history);
            setCurrentMoveIndex(0);
        } catch (e) {
            console.error("PGN Parsing Error", e);
        }
    }, [pgn]);

    // Update displayed board based on index
    useEffect(() => {
        if (fenHistory[currentMoveIndex]) {
            setBoard(fenHistory[currentMoveIndex].board);
        }
    }, [currentMoveIndex, fenHistory]);

    const handleNext = () => {
        if (currentMoveIndex < fenHistory.length - 1) {
            setCurrentMoveIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentMoveIndex > 0) {
            setCurrentMoveIndex(prev => prev - 1);
        }
    };

    // Render a single square
    const renderSquare = (piece, row, col) => {
        const isDark = (row + col) % 2 === 1;
        // Standard Chess colors
        const bgColor = isDark ? "#769656" : "#eeeed2";

        return (
            <div
                key={`${row}-${col}`}
                style={{
                    backgroundColor: bgColor,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {piece && (
                    <img
                        src={PIECE_IMAGES[piece.color][piece.type]}
                        alt={`${piece.color}${piece.type}`}
                        style={{ width: "90%", height: "90%", userSelect: "none" }}
                    />
                )}
            </div>
        );
    };

    if (!fenHistory.length) return <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>Loading Game...</div>;

    return (
        <div style={{ maxWidth: "450px", margin: "2rem auto", fontFamily: "sans-serif" }}>
            {/* Board Container */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gridTemplateRows: "repeat(8, 1fr)",
                width: "100%",
                aspectRatio: "1 / 1",
                border: "5px solid #404040",
                borderRadius: "4px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
            }}>
                {board.map((row, rowIndex) =>
                    row.map((piece, colIndex) => renderSquare(piece, rowIndex, colIndex))
                )}
            </div>

            {/* Controls */}
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "20px",
                marginTop: "20px",
                padding: "10px",
                background: "#f4f4f4",
                borderRadius: "8px"
            }}>
                <button
                    className="button button--secondary button--lg"
                    onClick={handlePrev}
                    disabled={currentMoveIndex === 0}
                    style={{ minWidth: "50px" }}
                >
                    ◀
                </button>

                <div style={{ fontSize: "1.2rem", fontWeight: "bold", minWidth: "100px", textAlign: "center" }}>
                    <span style={{ color: "#555", fontSize: "0.9rem" }}>Move</span> {currentMoveIndex} / {fenHistory.length - 1}
                </div>

                <button
                    className="button button--primary button--lg"
                    onClick={handleNext}
                    disabled={currentMoveIndex === fenHistory.length - 1}
                    style={{ minWidth: "50px" }}
                >
                    ▶
                </button>
            </div>
        </div>
    );
}