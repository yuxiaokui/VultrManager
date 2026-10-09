// 信奥赛 C++ 入门示例
// 功能：读取 n 个整数，输出它们的和、最大值、最小值
// 编译：g++ -std=c++14 -O2 -o demo demo.cpp
// 运行：./demo

#include <iostream>
#include <climits>
using namespace std;

int main() {
    int n;
    cin >> n;                       // 读入数据个数

    long long sum = 0;              // 和可能较大，用 long long
    int mx = INT_MIN;               // 最大值初始化为最小整数
    int mn = INT_MAX;               // 最小值初始化为最大整数

    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;                   // 逐个读入
        sum += x;
        if (x > mx) mx = x;
        if (x < mn) mn = x;
    }

    cout << "sum = " << sum << '\n';
    cout << "max = " << mx << '\n';
    cout << "min = " << mn << '\n';

    return 0;
}