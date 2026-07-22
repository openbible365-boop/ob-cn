import Capacitor
import UIKit

class MainViewController: CAPBridgeViewController {
    private let minimumStartupDuration: TimeInterval = 1.5
    private let startupBeganAt = ProcessInfo.processInfo.systemUptime
    private var startupOverlay: UIView?
    private var loadingObservation: NSKeyValueObservation?
    private var startupHideWorkItem: DispatchWorkItem?

    override func viewDidLoad() {
        installStartupOverlay()
        super.viewDidLoad()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AppleSignInPlugin())

        webView?.isOpaque = false
        webView?.backgroundColor = UIColor(
            red: 244 / 255,
            green: 245 / 255,
            blue: 247 / 255,
            alpha: 1
        )

        loadingObservation = webView?.observe(\.isLoading, options: [.initial, .new]) {
            [weak self] webView, _ in
            guard !webView.isLoading, webView.url != nil else { return }
            self?.scheduleStartupOverlayRemoval()
        }
    }

    private func installStartupOverlay() {
        let overlay = UIView()
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = UIColor(
            red: 244 / 255,
            green: 245 / 255,
            blue: 247 / 255,
            alpha: 1
        )

        let logo = UIImageView(image: UIImage(named: "LaunchBrand"))
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.contentMode = .scaleAspectFit

        let goldTitle = UILabel()
        goldTitle.text = "慧读"
        goldTitle.textColor = UIColor(
            red: 232 / 255,
            green: 154 / 255,
            blue: 44 / 255,
            alpha: 1
        )
        goldTitle.font = .systemFont(ofSize: 44, weight: .heavy)

        let inkTitle = UILabel()
        inkTitle.text = "圣经"
        inkTitle.textColor = UIColor(
            red: 24 / 255,
            green: 25 / 255,
            blue: 31 / 255,
            alpha: 1
        )
        inkTitle.font = .systemFont(ofSize: 44, weight: .heavy)

        let title = UIStackView(arrangedSubviews: [goldTitle, inkTitle])
        title.translatesAutoresizingMaskIntoConstraints = false
        title.axis = .horizontal

        let tagline = UILabel()
        tagline.translatesAutoresizingMaskIntoConstraints = false
        tagline.text = "智慧 · 读经 · 社群 · 共勉"
        tagline.textAlignment = .center
        tagline.textColor = UIColor(
            red: 71 / 255,
            green: 74 / 255,
            blue: 87 / 255,
            alpha: 1
        )
        tagline.font = .systemFont(ofSize: 24, weight: .semibold)

        overlay.addSubview(logo)
        overlay.addSubview(title)
        overlay.addSubview(tagline)
        view.addSubview(overlay)

        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            logo.widthAnchor.constraint(equalToConstant: 100),
            logo.heightAnchor.constraint(equalToConstant: 100),
            logo.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: overlay.centerYAnchor, constant: -100),
            title.topAnchor.constraint(equalTo: logo.bottomAnchor, constant: 50),
            title.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            tagline.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 16),
            tagline.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
        ])

        startupOverlay = overlay
    }

    private func scheduleStartupOverlayRemoval() {
        guard startupOverlay != nil else { return }

        startupHideWorkItem?.cancel()
        let elapsed = ProcessInfo.processInfo.systemUptime - startupBeganAt
        let remaining = max(0, minimumStartupDuration - elapsed)
        let workItem = DispatchWorkItem { [weak self] in
            self?.hideStartupOverlay()
        }
        startupHideWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + remaining, execute: workItem)
    }

    private func hideStartupOverlay() {
        guard let overlay = startupOverlay else { return }
        startupOverlay = nil
        startupHideWorkItem = nil
        overlay.removeFromSuperview()
    }
}
