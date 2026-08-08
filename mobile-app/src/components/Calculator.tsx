import React, { useState, useRef, useEffect } from "react";
import "./Calculator.css";

interface CalculatorProps {
  onUnlock: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onUnlock }) => {
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState<string>("");
  const [isReset, setIsReset] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);

  // 按钮震动反馈 (物理/Web震动)
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  // 处理数字输入
  const handleDigit = (digit: string) => {
    triggerHaptic();
    if (display === "0" || isReset) {
      setDisplay(digit);
      setIsReset(false);
    } else {
      // 限制输入长度，避免显示溢出
      if (display.length < 9) {
        setDisplay(display + digit);
      }
    }
  };

  // 处理运算符
  const handleOperator = (op: string) => {
    triggerHaptic();
    setEquation(display + " " + op + " ");
    setIsReset(true);
  };

  // 清除操作
  const handleClear = () => {
    triggerHaptic();
    setDisplay("0");
    setEquation("");
    setIsReset(true);
  };

  // 正负号切换
  const handleToggleSign = () => {
    triggerHaptic();
    if (display !== "0") {
      if (display.startsWith("-")) {
        setDisplay(display.slice(1));
      } else {
        setDisplay("-" + display);
      }
    }
  };

  // 百分比操作
  const handlePercent = () => {
    triggerHaptic();
    const current = parseFloat(display);
    if (!isNaN(current)) {
      setDisplay((current / 100).toString());
    }
  };

  // 计算结果 (核心解锁判断)
  const handleEvaluate = () => {
    triggerHaptic();
    
    // 隐秘指令解锁：输入 1004 后按 = 键
    if (display === "1004") {
      onUnlock();
      return;
    }

    if (!equation) return;

    const parts = equation.trim().split(" ");
    if (parts.length < 2) return;

    const prev = parseFloat(parts[0]);
    const op = parts[1];
    const current = parseFloat(display);

    if (isNaN(prev) || isNaN(current)) return;

    let result = 0;
    switch (op) {
      case "+":
        result = prev + current;
        break;
      case "-":
        result = prev - current;
        break;
      case "×":
        result = prev * current;
        break;
      case "÷":
        if (current === 0) {
          setDisplay("错误");
          setEquation("");
          setIsReset(true);
          return;
        }
        result = prev / current;
        break;
      default:
        return;
    }

    // 格式化输出，防止浮点数无限小数溢出
    let resultString = result.toString();
    if (resultString.includes(".") && resultString.length > 9) {
      resultString = result.toFixed(6);
      // 去除末尾无意义的0
      resultString = parseFloat(resultString).toString();
    }
    
    setDisplay(resultString);
    setEquation("");
    setIsReset(true);
  };

  // 处理显示器长按手势（隐秘解锁通道 2）
  const handleTouchStart = () => {
    startTime.current = Date.now();
    setIsUnlocking(true);

    longPressTimer.current = setTimeout(() => {
      triggerHaptic();
      if (navigator.vibrate) {
        navigator.vibrate([40, 40, 40]); // 强震动提示解锁成功
      }
      setIsUnlocking(false);
      onUnlock();
    }, 3000); // 3 秒长按
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsUnlocking(false);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <div className={`calculator-container ${isUnlocking ? "unlocking-glow" : ""}`}>
      {/* 隐藏的顶部栏，增加原生 App 感 */}
      <div className="status-bar-placeholder" />

      {/* 显示屏：支持长按解锁 */}
      <div
        className="calculator-display-area"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        <div className="calculator-equation">{equation}</div>
        <div className="calculator-result">{display}</div>
        <div className="helper-hint-invisible" />
      </div>

      {/* 按键面板 */}
      <div className="calculator-keypad">
        <button className="calc-btn fn-btn" onClick={handleClear}>
          {display === "0" ? "AC" : "C"}
        </button>
        <button className="calc-btn fn-btn" onClick={handleToggleSign}>
          ±
        </button>
        <button className="calc-btn fn-btn" onClick={handlePercent}>
          %
        </button>
        <button className="calc-btn op-btn" onClick={() => handleOperator("÷")}>
          ÷
        </button>

        <button className="calc-btn num-btn" onClick={() => handleDigit("7")}>
          7
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit("8")}>
          8
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit("9")}>
          9
        </button>
        <button className="calc-btn op-btn" onClick={() => handleOperator("×")}>
          ×
        </button>

        <button className="calc-btn num-btn" onClick={() => handleDigit("4")}>
          4
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit("5")}>
          5
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit("6")}>
          6
        </button>
        <button className="calc-btn op-btn" onClick={() => handleOperator("-")}>
          -
        </button>

        <button className="calc-btn num-btn" onClick={() => handleDigit("1")}>
          1
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit("2")}>
          2
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit("3")}>
          3
        </button>
        <button className="calc-btn op-btn" onClick={() => handleOperator("+")}>
          +
        </button>

        <button className="calc-btn num-btn zero-btn" onClick={() => handleDigit("0")}>
          0
        </button>
        <button className="calc-btn num-btn" onClick={() => handleDigit(".")}>
          .
        </button>
        <button className="calc-btn op-btn evaluate-btn" onClick={handleEvaluate}>
          =
        </button>
      </div>
      
      {/* 底部指示线，模拟 iOS Home Indicator */}
      <div className="home-indicator" />
    </div>
  );
};
export default Calculator;
