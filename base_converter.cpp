#include <iostream>
#include <string>
#include <sstream>
#include <limits>

// 将十进制整数转换为指定进制的字符串（支持负数、任意进制 2~36）
std::string toBase(long long value, int base) {
    static const char digits[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (value == 0) return "0";

    bool negative = value < 0;
    unsigned long long n = negative
        ? (unsigned long long)(-(value + 1)) + 1ULL  // 安全处理 LLONG_MIN
        : (unsigned long long)value;

    std::string result;
    while (n > 0) {
        result.insert(result.begin(), digits[n % base]);
        n /= base;
    }
    if (negative) result.insert(result.begin(), '-');
    return result;
}

int main() {
    std::cout << "十进制 -> 二进制 / 八进制 / 十六进制 转换工具\n";
    std::cout << "输入 q 退出\n\n";

    std::string line;
    while (true) {
        std::cout << "请输入十进制整数: ";
        if (!std::getline(std::cin, line)) break;  // EOF
        if (line == "q" || line == "Q") break;

        // 解析输入
        std::istringstream iss(line);
        long long value;
        char extra;
        if (!(iss >> value) || (iss >> extra)) {
            std::cout << "输入无效，请输入一个十进制整数。\n\n";
            continue;
        }

        std::cout << "  二进制:   " << toBase(value, 2)  << "\n";
        std::cout << "  八进制:   " << toBase(value, 8)  << "\n";
        std::cout << "  十六进制: " << toBase(value, 16) << "\n\n";
    }

    return 0;
}