"""一个简单的命令行计算器，支持加减乘除。"""


def add(a, b):
    return a + b


def subtract(a, b):
    return a - b


def multiply(a, b):
    return a * b


def divide(a, b):
    if b == 0:
        raise ZeroDivisionError("除数不能为 0")
    return a / b


OPERATIONS = {
    "+": add,
    "-": subtract,
    "*": multiply,
    "/": divide,
}


def calculate(a, op, b):
    if op not in OPERATIONS:
        raise ValueError(f"不支持的运算符: {op}")
    return OPERATIONS[op](a, b)


def main():
    print("简单计算器（输入 q 退出）")
    print("格式：数字 运算符 数字，例如 3 + 5")

    while True:
        expr = input(">>> ").strip()
        if expr.lower() in ("q", "quit", "exit"):
            print("已退出")
            break
        if not expr:
            continue

        parts = expr.split()
        if len(parts) != 3:
            print("输入格式错误，请使用：数字 运算符 数字")
            continue

        left, op, right = parts
        try:
            num1 = float(left)
            num2 = float(right)
            result = calculate(num1, op, num2)
            # 整数结果不带小数点
            if result == int(result):
                result = int(result)
            print(f"= {result}")
        except ValueError as e:
            print(f"错误: {e}")
        except ZeroDivisionError as e:
            print(f"错误: {e}")


if __name__ == "__main__":
    main()