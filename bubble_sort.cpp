// 信奥赛 C++ 冒泡排序示例
// 功能：读入 n 个整数，按从小到大排序后输出
// 编译：g++ -std=c++14 -O2 -o bubble_sort bubble_sort.cpp
// 运行：./bubble_sort

#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> a(n);
    for (int i = 0; i < n; i++) {
        cin >> a[i];
    }

    // 冒泡排序
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;              // 本轮是否发生交换
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);      // 前大后小则交换
                swapped = true;
            }
        }
        if (!swapped) break;               // 已有序，提前结束
    }

    for (int i = 0; i < n; i++) {
        cout << a[i] << (i == n - 1 ? '\n' : ' ');
    }

    return 0;
}