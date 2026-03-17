const { withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_VIEW_CONTROLLER_RELATIVE = 'ShareExtension/ShareViewController.swift';

// Correspond exactement au template expo-share-intent (2 espaces pour le corps)
const VIEW_DID_LOAD_ORIGINAL = `  override func viewDidLoad() {
    super.viewDidLoad()
  }

  override func viewDidAppear(_ animated: Bool) {`;

const VIEW_DID_LOAD_PATCH = `  private let accentBlue = UIColor(red: 0.04, green: 0.49, blue: 0.64, alpha: 1) // #0a7ea4

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
    setupSuccessModal()
  }

  private func setupSuccessModal() {
    let safe = view.safeAreaLayoutGuide
    let horizontalMargin: CGFloat = 32
    let maxCardWidth: CGFloat = 320

    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = .white
    card.layer.cornerRadius = 16
    card.clipsToBounds = true
    view.addSubview(card)

    let titleLabel = UILabel()
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.text = "Lien reçu."
    titleLabel.font = UIFont.systemFont(ofSize: 20, weight: .bold)
    titleLabel.textColor = .black
    titleLabel.textAlignment = .center
    card.addSubview(titleLabel)

    let config = UIImage.SymbolConfiguration(pointSize: 44, weight: .medium)
    let checkImage = UIImage(systemName: "checkmark.circle.fill", withConfiguration: config)
    let iconView = UIImageView(image: checkImage)
    iconView.translatesAutoresizingMaskIntoConstraints = false
    iconView.tintColor = accentBlue
    iconView.contentMode = .scaleAspectFit
    card.addSubview(iconView)

    let bodyLabel = UILabel()
    bodyLabel.translatesAutoresizingMaskIntoConstraints = false
    bodyLabel.text = "Ton lien a été envoyé à FromFeed et sera ajouté à ta liste une fois traité."
    bodyLabel.font = UIFont.systemFont(ofSize: 15, weight: .regular)
    bodyLabel.textColor = .black
    bodyLabel.textAlignment = .center
    bodyLabel.numberOfLines = 0
    bodyLabel.lineBreakMode = .byWordWrapping
    card.addSubview(bodyLabel)

    let button = UIButton(type: .system)
    button.translatesAutoresizingMaskIntoConstraints = false
    button.setTitle("Parfait", for: .normal)
    button.setTitleColor(.white, for: .normal)
    button.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
    button.backgroundColor = accentBlue
    button.layer.cornerRadius = 10
    button.addTarget(self, action: #selector(dismissExtension), for: .touchUpInside)
    card.addSubview(button)

    NSLayoutConstraint.activate([
      card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      card.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: horizontalMargin),
      card.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -horizontalMargin),
      card.widthAnchor.constraint(lessThanOrEqualToConstant: maxCardWidth),

      titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
      titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
      titleLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),

      iconView.centerXAnchor.constraint(equalTo: card.centerXAnchor),
      iconView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
      iconView.widthAnchor.constraint(equalToConstant: 56),
      iconView.heightAnchor.constraint(equalToConstant: 56),

      bodyLabel.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 16),
      bodyLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
      bodyLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),

      button.topAnchor.constraint(equalTo: bodyLabel.bottomAnchor, constant: 20),
      button.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
      button.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
      button.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
      button.heightAnchor.constraint(equalToConstant: 44),
    ])
  }

  @objc private func dismissExtension() {
    extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
  }

  /// Pour les liens : ne pas ouvrir l'app, garder le modal (fermeture via bouton « Parfait »).
  private func dismissWithoutOpeningApp() {}

  override func viewDidAppear(_ animated: Bool) {`;

/**
 * Patche ShareViewController.swift après génération par expo-share-intent :
 * - Modal succès (carte "Lien reçu.", bouton Parfait) au lieu d’une vue vide
 * - Pour URL/text : ne pas ouvrir l’app, rester sur le modal
 *
 * À placer après "expo-share-intent" dans app.json plugins.
 */
function patchShareViewController(content) {
  if (content.includes('private let accentBlue') && content.includes('dismissWithoutOpeningApp()')) {
    return content; // déjà patché
  }

  // Patch 1 : viewDidLoad + modal
  if (content.includes(VIEW_DID_LOAD_ORIGINAL)) {
    content = content.replace(VIEW_DID_LOAD_ORIGINAL, VIEW_DID_LOAD_PATCH);
  } else {
    const viewDidLoadRegex = /  override func viewDidLoad\(\) \{\s+super\.viewDidLoad\(\)\s+\}\s+\s+override func viewDidAppear\(_ animated: Bool\) \{/;
    if (viewDidLoadRegex.test(content)) {
      content = content.replace(viewDidLoadRegex, VIEW_DID_LOAD_PATCH);
    } else {
      console.warn('[with-share-extension-modal] viewDidLoad block not found - pattern may have changed');
    }
  }

  // Patch 2 : ne pas ouvrir l'app pour URL/text
  if (!content.includes('if type == .weburl || type == .text')) {
    const redirectRegex = /  private func redirectToHostApp\(type: RedirectType\) \{\n    let url = URL/;
    if (redirectRegex.test(content)) {
      content = content.replace(
        /  private func redirectToHostApp\(type: RedirectType\) \{\n    let url = URL/,
        `  private func redirectToHostApp(type: RedirectType) {
    if type == .weburl || type == .text {
      dismissWithoutOpeningApp()
      return
    }
    let url = URL`
      );
    }
  }
  return content;
}

function withShareExtensionModal(config) {
  return withXcodeProject(config, async (config) => {
    const iosRoot = config.modRequest.platformProjectRoot;
    const filePath = path.join(iosRoot, SHARE_VIEW_CONTROLLER_RELATIVE);

    if (!fs.existsSync(filePath)) {
      console.warn('[with-share-extension-modal] ShareViewController.swift not found at', filePath, '- skip.');
      return config;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const before = content;
    content = patchShareViewController(content);
    if (content !== before) {
      fs.writeFileSync(filePath, content);
      console.log('[with-share-extension-modal] Patched ShareViewController.swift (modal + no open app for links)');
    }
    return config;
  });
}

module.exports = withShareExtensionModal;
